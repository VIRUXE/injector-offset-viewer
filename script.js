const toast = document.getElementById("toast");

let injectorData = {};

fetch("injector-data.json")
.then(response => response.json())
.then(data => {
	injectorData = data;
	
	// Get search term from local storage
	const searchTerm = (new URLSearchParams(window.location.search)).get("searchTerm") || (typeof localStorage !== "undefined" ? localStorage.getItem("searchTerm") || "" : "");
	searchBar.value = searchTerm;

	searchInjectors(searchTerm);
	
	if (!window.location.port) searchBar.focus(); // Annoying with live preview
	searchBar.setSelectionRange(0, searchBar.value.length);
})
.catch(error => {
	const message = error instanceof SyntaxError ? "Failed to parse data!" : "Failed to load data!";
	displayToast(message);
	console.error(message, error);
});

function displayToast(message) {
	toast.textContent = message;
	toast.animate({ display: "block", opacity: [0, 1] }, { duration: 1000, fill: "forwards", easing: "ease-in-out" }).onfinish = () =>
		toast.animate({ display: "none", opacity: [1, 0] }, { duration: 1000, fill: "forwards", easing: "ease-in-out" });
}

function renderBatteryOffsetTable(offsets, show) {
	if (show === undefined) show = true;

	offsets = Object.fromEntries(Object.entries(offsets).sort((a, b) => parseFloat(b[1]) - parseFloat(a[1])))

	return `
		<table title="Click to copy the value." cellpadding="3px"${show ? "" : " style=\"display: none;\""}>
			<tr>${Object.keys(offsets).map(v => `<th>${v}</th>`).join("")}</tr>
			<tr>${Object.values(offsets).map(l => `<td>${l}</td>`).join("")}</tr>
		</table>
	`;
}

function renderPressureBatteryOffsetComponent(pressures) {
	return `
		<div class="pressure-control">
			<div class="pressure-tabs">
				${pressures.map(p => `<button title="${p.cc}CC" ${p.pressure === 43.5 ? 'class="active"' : ''}>${p.pressure} psi</button>`).join("")}
			</div>
			<div class="pressure-tables">
				${pressures.map(p => renderBatteryOffsetTable(p.offsets, p.pressure === 43.5)).join("")}
			</div>
		</div>
	`;
}

function createInjectorCard(brand, injector, isDuplicate, group) {
	const issueDescription = group ? 
		`${brand} ${group.description}`.replace(/\s+/g, ' ').trim() : 
		`${brand} ${injector.cc}CC ${injector.ohm}Ω ${group?.description ? `(${group.description})` : ''}`.replace(/\s+/g, ' ').trim();

	const card = document.createElement("div");
	card.className = "injector-card";
	card.innerHTML = `
		<h3>${brand}${isDuplicate ? ' <span class="warning-triangle" title="There are other injector-cards with the same Capacity and Impendance.">⚠️</span>' : ""}</h3>
		${group ? `<p><strong>Group:</strong> ${group.description}</p>` : injector.description ? `<p><strong>Description:</strong> ${injector.description}</p>` : ""}
		<p title="Double-click to change Flow Unit"><strong>Capacity:</strong> <span class="detail" style="cursor: help;"><span>${injector.cc}</span> CC/min</span>${injector.pressure ? ` at <span class="detail"><span>${injector.pressure}</span> PSI</span>` : ""}</p>
		${injector.ohm ? `<p><strong>Impedance:</strong> <span class="detail"><span>${injector.ohm}</span> Ω</span></p>` : ""}
		<div class="offsets-container">
			${group ? renderPressureBatteryOffsetComponent(group.injectors) : renderBatteryOffsetTable(injector.offsets)}
			<a class="detail" href="https://github.com/VIRUXE/injector-offset-viewer/issues/new?assignees=VIRUXE&labels=injector-data,website-submitted&projects=&template=wrong-offsets.md&title=Wrong+Offsets+for+${issueDescription}" target="_blank" title="Submit an Issue on GitHub">Are these offsets wrong?</a>
		</div>
	`;
	
	// Convert capacity unit on double-click 
	const getCapacityParagraph = card => Array.from(card.getElementsByTagName("p")).find(p => p.textContent.includes("Capacity"));

	getCapacityParagraph(card)?.addEventListener("dblclick", () => {
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

	// For every button inside "offsets-container" div, add event listener to switch between tables
	card.querySelectorAll(".pressure-tabs button").forEach((button, index) => {
		button.addEventListener("click", () => {
			const tables = card.querySelectorAll(".pressure-tables table");

			card.querySelector(".pressure-tabs button.active")?.classList.remove("active");
			const visibleTable = Array.from(tables).find(t => t.style.display !== "none");
			visibleTable.animate({ opacity: [1, 0] }, { duration: 200, fill: "forwards" }).onfinish = () => {
				visibleTable.style.display = "none";
				tables[index].style.display = "table";
				tables[index].animate({ opacity: [0, 1] }, { duration: 200, fill: "forwards" });
			};

			// tables[index].style.display = "table";
			button.classList.add("active");
		});
	});
	
	return card;
}

function displayInjectors(data = injectorData) {
	data = Object.fromEntries(Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]))); // Sort by brand name
	
	const grid = document.getElementById("injectorGrid");

	grid.innerHTML = "";

	function addCard(brand, injector, isDuplicate, group) {
		const card = createInjectorCard(brand, injector, isDuplicate, group);

		grid.appendChild(card);

		const tableContainer = card.getElementsByClassName("offsets-container")[0];
		const table          = tableContainer.getElementsByTagName("table")[0];

		card.addEventListener("mouseenter", () => {
			tableContainer.style.height = `${tableContainer.scrollHeight}px`;
			table.style.opacity         = 1;
		});

		card.addEventListener("mouseleave", () => {
			tableContainer.style.height = 0;
			table.style.opacity         = 0;
		});
	}

	for (const [brand, node] of Object.entries(data)) {
		node.sort((a, b) => a.cc - b.cc); // Sort by CC
		node.forEach(node => {
			const isGroup = node.injectors !== undefined;       // It's a group if "node" contains "injectors". I'm not renaming the entire JSON file for this
			const items   = isGroup ? node.injectors : [node];  // If it's a group, use the injectors/items inside it
			
			if (isGroup) {
				if (items.every(i => i.pressure)) // If all items in the group have pressure values
					addCard(brand, items.find(i => i.pressure === 43.5) || items[0], false, node);
				else
					items.forEach(injector => addCard(brand, injector, false, node));
			} else {
				items.sort((a, b) => a.cc - b.cc); // Sort by CC
				items.forEach(injector => 
					addCard(brand, injector, items.some(i => 
						i     !== injector &&
						i.cc  === injector.cc &&
						i.ohm === injector.ohm
					), isGroup ? node : null)
				);
			}
		});
	}

	// Here's some bleach for your eyes
	document.getElementById("count").textContent = Object.values(data).reduce((count, node) => {
		count += node.length;
		node.forEach(subNode => {
			if (subNode.injectors?.some(i => !i.pressure)) // Doesn't contain entries with pressure prop so it's a group of individual injectors
				count += subNode.injectors.length - 1; // Minus one because it's a group - we're not counting the group itself
		});
		return count;
	}, 0) + " injectors in total.";
}

function filterInjectors(searchTerm) {
	if (searchTerm.startsWith(" ")) return injectorData;

	const filtered = {};

	const terms = searchTerm.split(" ");
	for (const [brand, injectors] of Object.entries(injectorData)) {
		const filteredInjectors = injectors.filter(injector => {
			if (terms.every(term => 
				brand.toLowerCase().includes(term) ||
				(injector.description?.toLowerCase().includes(term) ?? false) ||
				(injector.cc?.toString().includes(term) ?? false) ||
				(injector.ohm?.toString().includes(term) ?? false)
			)) return true;
	
			return (injector.injectors || []).some(nestedInjector => 
				terms.every(term => 
					(nestedInjector.description?.toLowerCase().includes(term) ?? false) ||
					(nestedInjector.cc?.toString().includes(term) ?? false) ||
					(nestedInjector.ohm?.toString().includes(term) ?? false)
				)
			);
		})
	
		if (filteredInjectors.length > 0) filtered[brand] = filteredInjectors;
	}

	return filtered;
}

function searchInjectors(searchTerm = "") { // Empty string to reset search
	const filteredData = filterInjectors(searchTerm.toLowerCase());

	if (Object.entries(filteredData).length === 0) displayToast("No results found!");

	displayInjectors(filteredData);
}

const searchBar = document.getElementById("searchBar");
let searchDebounce;

searchBar.addEventListener("input", e => {
	const text = e.target.value;

	clearTimeout(searchDebounce);
	searchDebounce = setTimeout(() => {
		const url = new URL(window.location.href);
		text ? url.searchParams.set("searchTerm", text) : url.searchParams.delete("searchTerm");
		window.history.replaceState({}, "", url);

		searchInjectors(text);

		localStorage.setItem("searchTerm", text);
	}, 300);
});
searchBar.addEventListener("keydown", e => {
	// Only allow alphanumeric characters, backspace, space, and enter
	if (!/^[a-z0-9\s\b\n]+$/i.test(e.key)) e.preventDefault();
});
document.addEventListener("keypress", e => {
	if (e.key === "Enter") {
		if (document.activeElement === searchBar) // Unfocus the search bar
			e.target.blur();
		else {// Focus the search bar
			searchBar.focus();
			searchBar.setSelectionRange(0, searchBar.value.length);
		}
	}
});

const hint = document.getElementById("hint");

const hints = [
	"Type in the search bar to filter the injectors.",
	"Click on either voltage or latency to copy the value.",
	"Search by Brand, Description, Capacity, Impedance or a combination of them.",
	"Hover over a card to see the offsets table. <i>Voltage</i>/<i>ms</i>",
	"Want to add more data? Edit <a href=\"https://github.com/VIRUXE/injector-offset-viewer/edit/main/injector-data.json\">injector-data.json</a>, on GitHub.",
	"If pressure is not listed, it's usually 43.5 PSI (3 BAR) by default.",
	"Double-click the capacity to convert between CC/min and LB/hour.",
	"Click the top button to scroll back to the top.",
	"Support the project by donating through PayPal, at the bottom of the page.",
	"Have a suggestion or found a bug? Open an issue on GitHub.",
	"Press Enter to enter the search bar. If on mobile tap the search button on your keyboard to hide your keyboard.",
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
if (/Android|webOS|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
	hints.forEach((hint, index) => hints[index] = hint.replace(/Click|Hover/g, "Tap"));

	// Replace the iframe for the donation campaign with a simple linked button
	// * This iframe is too big for mobile devices
	document.querySelector("footer iframe").outerHTML = `
		<a href="https://www.paypal.com/donate?campaign_id=MQGC58FBTZGQC" target="_blank">
			<img src="https://www.paypalobjects.com/en_GB/i/btn/btn_donate_LG.gif" alt="Donate with PayPal" />
		</a>
	`;
}

// Retrieve last update date from GitHub API
fetch("https://api.github.com/repos/VIRUXE/injector-offset-viewer/commits")
.then(response => response.json())
.then(data => {
	// Index 1 because the first commit will be from github-actions
	document.getElementsByTagName("footer")[0].insertAdjacentHTML("afterbegin", `<p title="Latest commit: '${data[1].commit.message}'">Last updated: ${new Date(data[0].commit.author.date).toLocaleString()}</p>`);
})
.catch(error => console.error("Failed to retrieve last update date!", error));