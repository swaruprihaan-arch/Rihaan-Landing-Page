/* Simulator selection stays independent of flight simulation and saved progress. */
(() => {
  const arrow = '<span aria-hidden="true">↗</span>';
  const plane = `<img src="design/project/images/launch-flight.jpg" alt="Airliner on final approach against a golden sunset" loading="eager" decoding="async">`;
  const car = `<img src="design/project/images/launch-race.jpg" alt="Porsche 911 GT3 racing car at speed at night" loading="eager" decoding="async">`;
  function render(page, route) {
    page.scrollTop = 0;
    page.innerHTML = `<div class="portal-shell">
      <header class="portal-header"><a href="#/choose" class="portal-brand" aria-label="Simulator selection"><span aria-hidden="true">S</span>SIM<span class="portal-brand-detail">SIMULATION COLLECTION</span></a><span class="portal-note">A new perspective. Every time.</span></header>
      <section class="portal-intro"><span class="portal-kicker">CHOOSE YOUR WORLD</span><h1>Where will you go?</h1><p>Above the clouds or beyond the apex. Your next session starts here.</p></section>
      <div class="sim-choices">
        <a class="sim-choice flight-choice" href="#/home" aria-label="Open Flight Simulator">
          <div class="choice-top"><span class="choice-index">01 / AIR</span><span class="portal-pill available">Ready to fly</span></div>
          <div class="choice-art">${plane}</div>
          <div class="choice-copy"><span class="portal-kicker">THE SKY IS YOURS</span><h2>Flight<br>Simulator</h2><p>Find your aircraft. Plan your route.<br>Make every landing count.</p><span class="choice-action">Enter flight deck ${arrow}</span></div>
        </a>
        <a class="sim-choice racing-choice" href="#/race" aria-label="Open Racing Simulator">
          <div class="choice-top"><span class="choice-index">02 / TRACK</span><span class="portal-pill available">Ready to race</span></div>
          <div class="choice-art">${car}</div>
          <div class="choice-copy"><span class="portal-kicker">CHASE THE PERFECT LAP</span><h2>Racing<br>Simulator</h2><p>8 cars. 5 circuits. AI rivals.<br>Brake late, chase the perfect lap.</p><span class="choice-action">Enter the garage ${arrow}</span></div>
        </a>
      </div><footer class="portal-footer"><span>TWO WORLDS. ONE PLACE TO START.</span><span>Built for the joy of simulation.</span></footer>
    </div>`;
  }
  window.CT_PORTAL = { render };
})();
