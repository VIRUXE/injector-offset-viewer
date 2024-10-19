const toast = document.getElementById("toast");

let injectorData = {};

fetch("injector-data.json")
	.then(response => response.json())
	.then(data => {
		injectorData = data;
		displayInjectors();
	})
	.catch(error => displayToast(error instanceof SyntaxError ? "Failed to parse data!" : "Failed to load data!"));

function displayToast(message) {
	toast.textContent = message;
	toast.style.opacity = 1;
	setTimeout(() => toast.style.opacity = 0, toast.computedStyleMap().get("transition-duration").value * 1000 * 2);
}

function createInjectorCard(brand, injector) {
	const card = document.createElement("div");

	card.className = "injector-card";
	card.innerHTML = `
		<h3>${brand}</h3>
		<p><strong>Description:</strong> ${injector.description}</p>
		<p><strong>Capacity:</strong> <span class="detail"><span>${injector.cc}</span> CC</span></p>
		<p><strong>Impedance:</strong> <span class="detail"><span>${injector.ohm}</span> Ohm</span></p>
		<div>
			<table title="Click to copy the value.">
				<tr>${injector.voltage.map(v => `<th>${v}</th>`).join("")}</tr>
				<tr>${injector.latency.map(l => `<td>${l}</td>`).join("")}</tr>
			</table>
		</div>
	`;

	// Copy cell value to clipboard on click
	card.querySelectorAll("th, td").forEach(cell => cell.addEventListener("click", e =>
		navigator.clipboard.writeText(e.target.textContent)
			.then(() => displayToast('Copied to clipboard!'))
			.catch(() => displayToast('Failed to copy to clipboard!'))
	));
	
	return card;
}

function displayInjectors(data = injectorData) {
	const grid = document.getElementById("injectorGrid");

	grid.innerHTML = "";

	for (const [brand, injectors] of Object.entries(data)) {
		injectors.forEach(injector => {
			(injector.variants || [injector]).forEach(injectorData => {
				if (injector.variants) injectorData.description = injector.description;
				
				const card = createInjectorCard(brand, injectorData);

				grid.appendChild(card);

				const tableContainer = card.getElementsByTagName("div")[0];
				const table          = tableContainer.getElementsByTagName("table")[0];
				const tableHeight    = tableContainer.scrollHeight;

				card.addEventListener("mouseenter", () => {
					tableContainer.style.height = `${tableHeight}px`;
					table.style.opacity         = 1;
				});

				card.addEventListener("mouseleave", () => {
					tableContainer.style.height = "0";
					table.style.opacity         = 0;
				});
			});
		});
}

function filterInjectors(searchTerm) {
	const filtered = {};
	const lowerSearchTerm = searchTerm.toLowerCase();

	for (const [brand, injectors] of Object.entries(injectorData)) {
		const filteredInjectors = injectors.filter(injector => {
			const matches = brand.toLowerCase().includes(lowerSearchTerm) ||
				(injector.description && injector.description.toLowerCase().includes(lowerSearchTerm)) ||
				(injector.cc && injector.cc.toString().includes(lowerSearchTerm)) ||
				(injector.ohm && injector.ohm.toString().includes(lowerSearchTerm));

			if (matches) return true;

			const variants = injector.variants || [];

			return variants.some(variant => 
				(variant.description && variant.description.toLowerCase().includes(lowerSearchTerm)) ||
				(variant.cc && variant.cc.toString().includes(lowerSearchTerm)) ||
				(variant.ohm && variant.ohm.toString().includes(lowerSearchTerm))
			);
		});

		if (filteredInjectors.length > 0) filtered[brand] = filteredInjectors;
	}

	return filtered;
}

document.getElementById("searchBar").addEventListener("input", e => {
	const filteredData = filterInjectors(e.target.value.toLowerCase());

	if (Object.entries(filteredData).length === 0) displayToast("No results found!");

	displayInjectors(filteredData);
});

const hint = document.getElementById("hint");

const hints = [
	"Type in the search bar to filter the injectors.",
	"Click on a latency value to copy it to the clipboard.",
	"Search by Brand, Description, Capacity or Impedance.",
	"Hover over a card to see the latency table. Voltage/ms",
];

// Replace "Click" and "Hover" with "Tap" and "Touch" on mobile devices
if (/Android|webOS|iPhone|iPad|iPod|IEMobile|Opera Mini|SamsungTV/i.test(navigator.userAgent)) {
	hints[1] = hints[1].replace("Click", "Tap");
	hints[3] = hints[3].replace("Hover", "Touch");
}

let currentHint = Math.floor(Math.random() * hints.length);

// Change hint every 5 seconds
setInterval(() => {
	hint.style.opacity = 0;

	setTimeout(() => {
		hint.textContent   = hints[currentHint];
		hint.style.opacity = 1;
		currentHint = (currentHint + 1) % hints.length;
	}, hint.computedStyleMap().get("transition-duration").value * 1000);
}, 5000);

hint.textContent = hints[currentHint];

displayInjectors();