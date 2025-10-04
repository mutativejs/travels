import "./style.css";
import { setupTravelsCounter } from "./counter.ts";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <h1>Travels Counter Demo</h1>
    <div class="card">
      <div class="counter-display">
        <span id="counter-value">0</span>
      </div>
      <div class="controls">
        <button id="increment" type="button">+1</button>
        <button id="decrement" type="button">-1</button>
        <button id="reset" type="button">Reset</button>
      </div>
      <div class="history-controls">
        <button id="undo" type="button" disabled>Undo</button>
        <button id="redo" type="button" disabled>Redo</button>
        <button id="archive" type="button">Archive</button>
      </div>
      <div class="history-info">
        <div class="info-section">
          <h3>History State</h3>
          <div id="history-states"></div>
        </div>
        <div class="info-section">
          <h3>Current Position</h3>
          <span id="current-position">0</span>
        </div>
        <div class="info-section">
          <h3>Patches Info</h3>
          <div id="patches-info"></div>
        </div>
      </div>
    </div>
  </div>
`;

setupTravelsCounter();
