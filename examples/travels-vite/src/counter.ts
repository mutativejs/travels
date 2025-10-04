import { createTravels } from "travels";

// Export for potential external use
export function setupTravelsCounter() {
  interface CounterState {
    count: number;
    timestamp: number;
  }

  // Create a travels instance with manual archive mode for better control
  const travels = createTravels<CounterState>(
    { count: 0, timestamp: Date.now() },
    {
      maxHistory: 3,
      autoArchive: false, // Manual archive mode for better control
    }
  );

  // Get DOM elements
  const counterValue = document.getElementById("counter-value")!;
  const undoButton = document.getElementById("undo") as HTMLButtonElement;
  const redoButton = document.getElementById("redo") as HTMLButtonElement;
  const archiveButton = document.getElementById("archive") as HTMLButtonElement;
  const incrementButton = document.getElementById(
    "increment"
  ) as HTMLButtonElement;
  const decrementButton = document.getElementById(
    "decrement"
  ) as HTMLButtonElement;
  const resetButton = document.getElementById("reset") as HTMLButtonElement;
  const historyStates = document.getElementById("history-states")!;
  const currentPosition = document.getElementById("current-position")!;
  const patchesInfo = document.getElementById("patches-info")!;

  // Update UI based on current state
  function updateUI() {
    const state = travels.getState();
    const position = travels.getPosition();
    const patches = travels.getPatches();
    const history = travels.getHistory();

    // Update counter display
    counterValue.textContent = state.count.toString();

    // Update button states
    undoButton.disabled = !travels.canBack();
    redoButton.disabled = !travels.canForward();
    archiveButton.disabled = !travels.canArchive();

    // Update position display
    currentPosition.textContent = position.toString();

    // Update history states display
    historyStates.innerHTML = history
      .map((state, index) => {
        const isCurrent = index === position;
        return `
          <div class="history-item ${isCurrent ? "current" : ""}">
            <span class="position">${index}</span>
            <span class="count">${state.count}</span>
            <span class="timestamp">${new Date(
              state.timestamp
            ).toLocaleTimeString()}</span>
          </div>
        `;
      })
      .join("");

    // Update patches info
    const patchesCount = patches.patches.length;
    const inversePatchesCount = patches.inversePatches.length;

    patchesInfo.innerHTML = `
      <div class="patches-summary">
        <div>Forward Patches: ${patchesCount}</div>
        <div>Inverse Patches: ${inversePatchesCount}</div>
      </div>
      <details>
        <summary>View Patches Details</summary>
        <div class="patches-details">
          <div class="patches-section">
            <h4>Forward Patches:</h4>
            <pre>${JSON.stringify(patches.patches, null, 2)}</pre>
          </div>
          <div class="patches-section">
            <h4>Inverse Patches:</h4>
            <pre>${JSON.stringify(patches.inversePatches, null, 2)}</pre>
          </div>
        </div>
      </details>
    `;
  }

  // Subscribe to state changes
  travels.subscribe((state, patches, position) => {
    console.log("State changed:", {
      state,
      position,
      patchesCount: patches.patches.length,
    });
    updateUI();
  });

  // Event handlers
  incrementButton.addEventListener("click", () => {
    travels.setState((draft) => {
      draft.count += 1;
      draft.timestamp = Date.now();
    });
    travels.archive(); // Commit the change to history
  });

  decrementButton.addEventListener("click", () => {
    travels.setState((draft) => {
      draft.count -= 1;
      draft.timestamp = Date.now();
    });
    travels.archive(); // Commit the change to history
  });

  resetButton.addEventListener("click", () => {
    travels.reset();
  });

  undoButton.addEventListener("click", () => {
    travels.back();
  });

  redoButton.addEventListener("click", () => {
    travels.forward();
  });

  archiveButton.addEventListener("click", () => {
    travels.archive();
  });

  // Initialize UI
  updateUI();
  console.log("Travels Counter initialized");
}
