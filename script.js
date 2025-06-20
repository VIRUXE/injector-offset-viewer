const toast = document.getElementById("toast");
let injectorData = {};

// Track created cards and their cleanup functions for proper memory management
const cardCleanupMap = new WeakMap();
const activeCards = new Set();

(async () => {
    try {
        const response = await fetch("injector-data.json");
        injectorData = await response.json();
        
        const params = new URLSearchParams(window.location.search);
        const searchTerm = params.get("searchTerm") ?? localStorage?.getItem("searchTerm") ?? "";
        searchBar.value = searchTerm;

        searchInjectors(searchTerm);
        
        if (!window.location.port) searchBar.focus();
        searchBar.setSelectionRange(0, searchBar.value.length);
    } catch (error) {
        const message = error instanceof SyntaxError ? "Failed to parse data!" : "Failed to load data!";
        displayToast(message);
        console.error(message, error);
    }
})();

let toastAnimations = [];

function displayToast(message) {
	// Cancel any existing animations to prevent race conditions
	toastAnimations.forEach(animation => animation.cancel());
	toastAnimations = [];
	
	toast.textContent = message;
	
	// Show animation
	const showAnimation = toast.animate(
		{ display: "block", opacity: [0, 1] }, 
		{ duration: 1000, fill: "forwards", easing: "ease-in-out" }
	);
	toastAnimations.push(showAnimation);
	
	showAnimation.onfinish = () => {
		// Hide animation
		const hideAnimation = toast.animate(
			{ display: "none", opacity: [1, 0] }, 
			{ duration: 1000, fill: "forwards", easing: "ease-in-out" }
		);
		toastAnimations.push(hideAnimation);
		
		hideAnimation.onfinish = () => {
			// Clean up completed animations
			toastAnimations = toastAnimations.filter(anim => anim !== hideAnimation);
		};
	};
}

const renderBatteryOffsetTable = (offsets, show = true) => {
    const sortedOffsets = Object.fromEntries(Object.entries(offsets).sort(([,a], [,b]) => parseFloat(b) - parseFloat(a)));

    return `
        <table title="Click to copy the value." cellpadding="3px"${show ? "" : ' style="display: none;"'}>
            <tr>${Object.keys(sortedOffsets).map(v => `<th>${v}</th>`).join("")}</tr>
            <tr>${Object.values(sortedOffsets).map(l => `<td>${l}</td>`).join("")}</tr>
        </table>
    `;
};

function renderPressureBatteryOffsetComponent(pressures) {
    return `
        <div class="pressure-control">
            <div class="pressure-tabs">
                ${pressures.map(p => `<button title="${p.cc}CC" ${!p.pressure || p.pressure === 43.5 ? 'class="active"' : ''}>${p.pressure || 43.5} psi</button>`).join("")}
            </div>
            <div class="pressure-tables">
                ${pressures.map(p => renderBatteryOffsetTable(p.offsets, !p.pressure || p.pressure === 43.5)).join("")}
            </div>
        </div>
    `;
}

function createInjectorCard(brand, injector, isDuplicate, group) {
    const issueDescription = group ? 
        `${brand} ${group.description}`.replace(/\s+/g, ' ').trim() : 
        `${brand} ${injector.cc}CC ${injector.ohm}Ω ${group?.description ? `(${group.description})` : ''}`.replace(/\s+/g, ' ').trim();

    const hasMultiplePressures = group?.injectors && group.injectors.length > 1 && group.injectors.every(i => i.pressure);

    const card = document.createElement("div");
    card.className = "injector-card";
    card.innerHTML = `
        <h3>${brand}${isDuplicate ? ' <span class="warning-triangle" title="There are other injector-cards with the same Capacity and Impendance.">⚠️</span>' : ""}</h3>
        ${group ? `<p><strong>Group:</strong> ${group.description}</p>` : injector.description ? `<p><strong>Description:</strong> ${injector.description}</p>` : ""}
        <p title="Double-click to change Flow Unit"><strong>Capacity:</strong> <span class="detail" style="cursor: help;"><span>${injector.cc}</span> CC/min</span>${injector.pressure ? ` at <span class="detail"><span>${injector.pressure}</span> PSI</span>` : ""}</p>
        ${injector.ohm ? `<p><strong>Impedance:</strong> <span class="detail"><span>${injector.ohm}</span> Ω</span></p>` : ""}
        <div class="offsets-container">
            ${hasMultiplePressures ? renderPressureBatteryOffsetComponent(group.injectors) : renderBatteryOffsetTable(injector.offsets)}
            <a class="detail" href="https://github.com/VIRUXE/injector-offset-viewer/issues/new?assignees=VIRUXE&labels=injector-data,website-submitted&projects=&template=wrong-offsets.md&title=Wrong+Offsets+for+${issueDescription}" target="_blank" title="Submit an Issue on GitHub">Are these offsets wrong?</a>
        </div>
    `;

    // Array to store all event listeners for cleanup
    const eventListeners = [];
	
	// Convert capacity unit on double-click 
	const getCapacityParagraph = card => Array.from(card.getElementsByTagName("p")).find(p => p.textContent.includes("Capacity"));

	const capacityDblClickHandler = () => {
		const CONVERSION_FACTOR = 0.09583;

		// Only update active cards instead of querying the entire document
		activeCards.forEach(activeCard => {
			const capacitySpan = getCapacityParagraph(activeCard)?.querySelector("span");
			if (!capacitySpan) return;
			
			const isCC = capacitySpan.textContent.includes("CC");
			const value = parseFloat(capacitySpan.textContent);
			const newValue = isCC ? (value * CONVERSION_FACTOR).toFixed(2) : (value / CONVERSION_FACTOR).toFixed(0);

			capacitySpan.innerHTML = `<span>${newValue}</span> ${isCC ? "LB/hour" : "CC/min"}`;
		});
	};

	const capacityParagraph = getCapacityParagraph(card);
	if (capacityParagraph) {
		capacityParagraph.addEventListener("dblclick", capacityDblClickHandler);
		eventListeners.push(() => capacityParagraph.removeEventListener("dblclick", capacityDblClickHandler));
	}

	// Copy cell value to clipboard on click
	const cellClickHandler = (e) => {
		navigator.clipboard.writeText(e.target.textContent)
			.then(() => displayToast('Copied to clipboard!'))
			.catch(() => displayToast('Failed to copy to clipboard!'));
	};

	card.querySelectorAll("th, td").forEach(cell => {
		cell.addEventListener("click", cellClickHandler);
		eventListeners.push(() => cell.removeEventListener("click", cellClickHandler));
	});

	// For every button inside "offsets-container" div, add event listener to switch between tables
	card.querySelectorAll(".pressure-tabs button").forEach((button, index) => {
		const buttonClickHandler = () => {
			const tables = card.querySelectorAll(".pressure-tables table");

			card.querySelector(".pressure-tabs button.active")?.classList.remove("active");
			const visibleTable = Array.from(tables).find(t => t.style.display !== "none");
			
			if (visibleTable) {
				visibleTable.animate({ opacity: [1, 0] }, { duration: 200, fill: "forwards" }).onfinish = () => {
					visibleTable.style.display = "none";
					tables[index].style.display = "table";
					tables[index].animate({ opacity: [0, 1] }, { duration: 200, fill: "forwards" });
				};
			} else {
				// Fallback if no visible table found
				tables[index].style.display = "table";
				tables[index].animate({ opacity: [0, 1] }, { duration: 200, fill: "forwards" });
			}

			button.classList.add("active");
		};

		button.addEventListener("click", buttonClickHandler);
		eventListeners.push(() => button.removeEventListener("click", buttonClickHandler));
	});

	// Store cleanup function for this card
	cardCleanupMap.set(card, () => {
		eventListeners.forEach(cleanup => cleanup());
		activeCards.delete(card);
	});

	// Add to active cards set
	activeCards.add(card);
	
	return card;
}

function displayInjectors(data = injectorData) {
	data = Object.fromEntries(Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]))); // Sort by brand name
	
	const grid = document.getElementById("injectorGrid");

	// Clean up existing cards and their event listeners
	const existingCards = Array.from(grid.children);
	existingCards.forEach(card => {
		const cleanup = cardCleanupMap.get(card);
		if (cleanup) {
			cleanup();
			cardCleanupMap.delete(card);
		}
	});

	// Use DocumentFragment for efficient DOM manipulation
	const fragment = document.createDocumentFragment();

	function addCard(brand, injector, isDuplicate, group) {
		const card = createInjectorCard(brand, injector, isDuplicate, group);
		
		const offsetsContainer = card.getElementsByClassName("offsets-container")[0];
		let defaultHeight = null;
		let isExpanded = false;

		const cardClickHandler = (e) => {
			// Don't toggle if clicking table cells
			if (e.target.matches('td, th')) return;
			
			// Calculate default height on first click if not already calculated
			if (defaultHeight === null) defaultHeight = card.computedStyleMap().get("height").value;
			
			isExpanded = !isExpanded;
			
			card.animate(
				{ height: isExpanded ? 
					[`${defaultHeight}px`, `${defaultHeight + offsetsContainer.scrollHeight}px`] : 
					[`${defaultHeight + offsetsContainer.scrollHeight}px`, `${defaultHeight}px`] 
				}, 
				{ duration: 250, fill: "forwards" }
			);
	
			offsetsContainer.animate(
				{ 
					marginTop: isExpanded ? [0, '10px'] : ['10px', 0], 
					height: isExpanded ? 
						[0, `${offsetsContainer.scrollHeight}px`] : 
						[`${offsetsContainer.scrollHeight}px`, 0], 
					opacity: isExpanded ? [0, 1] : [1, 0] 
				}, 
				{ duration: 250, fill: "forwards" }
			);
		};

		card.addEventListener("click", cardClickHandler);
		
		// Add the card click handler to the cleanup function
		const existingCleanup = cardCleanupMap.get(card);
		cardCleanupMap.set(card, () => {
			if (existingCleanup) existingCleanup();
			card.removeEventListener("click", cardClickHandler);
		});

		fragment.appendChild(card);
	}

	for (const [brand, node] of Object.entries(data)) {
		node.sort((a, b) => a.cc - b.cc); // Sort by CC
		node.forEach(node => {
			const isGroup = node.injectors !== undefined;       // It's a group if "node" contains "injectors". I'm not renaming the entire JSON file for this
			const items   = isGroup ? node.injectors : [node];  // If it's a group, use the injectors/items prop inside it
			
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

	// Clear the grid and append all new cards at once using DocumentFragment
	grid.innerHTML = "";
	grid.appendChild(fragment);

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

const filterInjectors = searchTerm => {
    if (searchTerm.startsWith(" ")) return injectorData;

    return Object.fromEntries(
        Object.entries(injectorData)
            .map(([brand, injectors]) => [
                brand,
                injectors.filter(injector => {
                    const terms = searchTerm.split(" ");
                    return terms.every(term => 
                        brand.toLowerCase().includes(term) ||
                        injector.description?.toLowerCase().includes(term) ||
                        injector.cc?.toString().includes(term) ||
                        injector.ohm?.toString().includes(term) ||
                        injector.injectors?.some(nested => 
                            nested.description?.toLowerCase().includes(term) ||
                            nested.cc?.toString().includes(term) ||
                            nested.ohm?.toString().includes(term)
                        )
                    );
                })
            ])
            .filter(([, injectors]) => injectors.length > 0)
    );
};

function searchInjectors(searchTerm = "") { // Empty string to reset search
	const filteredData = filterInjectors(searchTerm.toLowerCase());

	if (Object.entries(filteredData).length === 0) displayToast("No results found!");

	displayInjectors(filteredData);
}

const searchBar = document.getElementById("searchBar");
let searchDebounce;

searchBar.addEventListener("input", e => {
	clearTimeout(searchDebounce);
	searchDebounce = setTimeout(() => {
		const text = e.target.value;
		const url  = new URL(window.location.href);

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
		hint.innerHTML = hints[currentHint];
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
const { thanks, cancelledDonation } = Object.fromEntries(new URLSearchParams(window.location.search));

if (thanks) {
    displayToast("Thank you for your support!");
    const thankYouMessage = document.createElement("p");
    Object.assign(thankYouMessage, {
        textContent: "THANK YOU FOR YOUR SUPPORT!",
        style: {
            fontSize: "larger",
            textAlign: "center",
            margin: "2em 0"
        }
    });
    document.body.prepend(thankYouMessage);
} else if (cancelledDonation) {
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
(async () => {
    try {
        const response = await fetch("https://api.github.com/repos/VIRUXE/injector-offset-viewer/commits");
        const data = await response.json();
        const { commit: { message, author: { date } } } = data[1];
        const footer = document.querySelector("footer");
        footer.insertAdjacentHTML(
            "afterbegin", 
            `<p title="Latest commit: '${message}'">Last updated: ${new Date(date).toLocaleString()}</p>`
        );
    } catch (error) {
        console.error("Failed to retrieve last update date!", error);
    }
})();