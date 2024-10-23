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
	toast.animate({ display: "block", opacity: [0, 1] }, { duration: 1000, fill: "forwards", easing: "ease-in-out" }).onfinish = () =>
		toast.animate({ display: "none", opacity: [1, 0] }, { duration: 1000, fill: "forwards", easing: "ease-in-out" });
}

function createInjectorCard(brand, injector) {
	const card = document.createElement("div");
	card.className = "injector-card";
	card.innerHTML = `
		<h3>${brand}</h3>
		${injector.description ? `<p><strong>Description:</strong> ${injector.description}</p>` : ""}
		<p title="Double-click to change Flow Unit"><strong>Capacity:</strong> <span class="detail"><span>${injector.cc}</span> CC/min</span></p>
		${injector.ohm ? `<p><strong>Impedance:</strong> <span class="detail"><span>${injector.ohm}</span> Ohm</span></p>` : ""}
		<div>
				<tr>${Object.keys(injector.offsets).map(v => `<th>${v}</th>`).join("")}</tr>
				<tr>${Object.values(injector.offsets).map(l => `<td>${l}</td>`).join("")}</tr>
			</table>
		</div>
	`;
	
	// Convert capacity unit on double-click 
	const getCapacityParagraph = card => Array.from(card.getElementsByTagName("p")).find(p => p.textContent.includes("Capacity"));

	getCapacityParagraph(card).addEventListener("dblclick", () => {
		const CONVERSION_FACTOR = 0.09583;

		document.querySelectorAll(".injector-card").forEach(card => {
			const capacitySpan = getCapacityParagraph(card).querySelector("span");
			const isCC         = capacitySpan.textContent.includes("CC");

			const value    = parseFloat(capacitySpan.textContent);
			const newValue = isCC ? (value * CONVERSION_FACTOR).toFixed(2) : (value / CONVERSION_FACTOR).toFixed(0);

			capacitySpan.innerHTML = `<span>${newValue}</span> ${isCC ? "LB/hour" : "CC/min"}`;
		});
	});

	// Copy cell value to clipboard on click
	card.querySelectorAll("th, td").forEach(cell => cell.addEventListener("click", e =>
		navigator.clipboard.writeText(e.target.textContent)
			.then(() => displayToast('Copied to clipboard!'))
			.catch(() => displayToast('Failed to copy to clipboard!'))
	));
	
	return card;
}

function displayInjectors(data = injectorData) {
	// Sort by brand name
	data = Object.fromEntries(Object.entries(data).sort((a, b) => a[0].localeCompare(b[0])));
	
	const grid = document.getElementById("injectorGrid");

	grid.innerHTML = "";

	for (const [brand, injectors] of Object.entries(data)) {
		injectors.forEach(injector => {
			(injector.variants || [injector]).forEach(injectorData => {
				if (injector.variants) injectorData.description = '(Variant) ' + injector.description;

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

	document.getElementById("count").textContent = Object.values(data).flat().length + " injectors in total.";
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

const searchBar = document.getElementById("searchBar");
searchBar.addEventListener("input", e => {
	const filteredData = filterInjectors(e.target.value.toLowerCase());

	if (Object.entries(filteredData).length === 0) displayToast("No results found!");

	displayInjectors(filteredData);
});
searchBar.focus();

const hint = document.getElementById("hint");

const hints = [
	"Type in the search bar to filter the injectors.",
	"Click on a latency value to copy it to the clipboard.",
	"Search by Brand, Description, Capacity or Impedance.",
	"Hover over a card to see the latency table. <i>Voltage</i>/<i>ms</i>",
	"Want to add more data? Edit <a href=\"https://github.com/VIRUXE/injector-offset-viewer/edit/main/injector-data.json\">injector-data.json</a>, on GitHub.",
	"If pressure is not listed, it's usually 43.5 PSI (3 BAR).",
];

let currentHint = Math.floor(Math.random() * hints.length);

// Change hint every 5 seconds
setInterval(() => {
	hint.style.opacity = 0;

	setTimeout(() => {
		hint.innerHTML   = hints[currentHint];
		hint.style.opacity = 1;
		currentHint = (currentHint + 1) % hints.length;
	}, hint.computedStyleMap().get("transition-duration").value * 1000);
}, 5000);

hint.innerHTML = hints[currentHint];

// Scroll to top button
const topElement = document.getElementById("top");
window.onscroll = () => {
	const hasScrolledEnough = document.body.scrollTop > 20 || document.documentElement.scrollTop > 20;

	if (hasScrolledEnough && topElement.style.display === "flex") return;
	if (!hasScrolledEnough && topElement.style.display === "none") return;

	topElement.style.display = hasScrolledEnough ? "flex" : "none";
	topElement.animate({ opacity: hasScrolledEnough ? [0, 1] : [1, 0] }, { duration: 500, fill: "forwards", easing: "ease-in-out" });
}

topElement.addEventListener("click", () => {
	document.body.scrollTop            = 0;
	document.documentElement.scrollTop = 0;
});

// Interactions for PayPal donation callbacks
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('thanks')) { 
	displayToast("Thank you for your support!");

	const thankYouMessage = document.createElement("p");

	with (thankYouMessage) {
		textContent     = "THANK YOU FOR YOUR SUPPORT!";
		style.fontSize  = "larger";
		style.textAlign = "center";
		style.margin    = "2em 0";
	}

	document.body.insertBefore(thankYouMessage, document.body.firstChild);
} else if (urlParams.has('cancelledDonation')) {
	displayToast("Donation Cancelled!");
}

// Mobile stuff
if (/Android|webOS|iPhone|iPad|iPod|IEMobile|Opera Mini|SamsungTV/i.test(navigator.userAgent)) {
	hints[1] = hints[1].replace("Click", "Tap");
	hints[3] = hints[3].replace("Hover", "Touch");

	// Replace the iframe for the donation campaign with a simple linked button
	// * This iframe is too big for mobile devices
	document.querySelector("footer iframe").outerHTML = `
		<a href="https://www.paypal.com/donate?campaign_id=MQGC58FBTZGQC" target="_blank">
			<img src="https://www.paypalobjects.com/en_GB/i/btn/btn_donate_LG.gif" alt="Donate with PayPal" />
		</a>
	`;
}