(function () {
  "use strict";

  var state = {
    strideId: localStorage.getItem("approach.stride") || "average",
    profile: loadProfile(),
    crowdLevel: "typical",
    venueId: null,
    originId: null,
    sectionId: null,
    detours: []
  };

  var $ = function (id) { return document.getElementById(id); };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function loadProfile() {
    var defaults = {
      environments: { indoor: true, outdoor: true, mixed: true },
      maxSize: "stadium",
      maxWalkMinutes: null,
      seatingIntegratedOnly: false,
      sightlineClearOnly: false,
      companionRequired: false
    };
    try {
      var saved = JSON.parse(localStorage.getItem("approach.profile"));
      if (saved) {
        if (saved.environments) {
          defaults.environments.indoor = !!saved.environments.indoor;
          defaults.environments.outdoor = !!saved.environments.outdoor;
          defaults.environments.mixed = !!saved.environments.mixed;
        }
        if (saved.maxSize) defaults.maxSize = saved.maxSize;
        if (typeof saved.maxWalkMinutes === "number") defaults.maxWalkMinutes = saved.maxWalkMinutes;
        defaults.seatingIntegratedOnly = !!saved.seatingIntegratedOnly;
        defaults.sightlineClearOnly = !!saved.sightlineClearOnly;
        defaults.companionRequired = !!saved.companionRequired;
      }
    } catch (e) { /* ignore malformed saved profile */ }
    return defaults;
  }

  function saveProfile() {
    localStorage.setItem("approach.profile", JSON.stringify(state.profile));
  }

  function stride() {
    var s = STRIDE_PRESETS.filter(function (p) { return p.id === state.strideId; })[0];
    return s || STRIDE_PRESETS[2];
  }

  function venue() {
    return VENUES.filter(function (v) { return v.id === state.venueId; })[0];
  }

  function steps(meters) {
    return Math.round(meters / stride().meters);
  }

  function feet(meters) {
    return Math.round(meters * 3.28084);
  }

  function trustLabel(t) {
    if (t === "verified") return "Verified route";
    if (t === "community") return "Community confirmed";
    return "Unverified";
  }

  /* ---------- route/venue helpers ---------- */

  function sizeRank(cat) { return SIZE_ORDER.indexOf(cat); }

  function segmentTotals(segments) {
    var meters = 0, stairs = 0;
    segments.forEach(function (s) { meters += s.meters; stairs += s.stairs; });
    return { meters: meters, stairs: stairs };
  }

  function originIsDropoff(o) {
    return /curbside/i.test(o.kind) && segmentTotals(o.segments).stairs === 0;
  }

  function bestCase(v) {
    var minMinutes = null, stepFree = false;
    v.origins.forEach(function (o) {
      v.sections.forEach(function (s) {
        var ot = segmentTotals(o.segments), st = segmentTotals(s.segments);
        var meters = ot.meters + st.meters;
        var stairs = ot.stairs + st.stairs;
        var minutes = Math.round(meters / 60);
        if (minMinutes === null || minutes < minMinutes) minMinutes = minutes;
        if (stairs === 0) stepFree = true;
      });
    });
    return { minWalkMinutes: minMinutes, hasStepFreeRoute: stepFree };
  }

  function matchesProfile(v) {
    var p = state.profile;
    var reasons = [];

    if (!p.environments[v.environment]) {
      reasons.push(v.environment === "outdoor" ? "Outdoor venue"
        : v.environment === "mixed" ? "Mixed indoor/outdoor venue"
        : "Indoor venue excluded");
    }

    if (sizeRank(v.sizeCategory) > sizeRank(p.maxSize)) {
      reasons.push(SIZE_LABELS[v.sizeCategory] + ", larger than your limit");
    }

    var bc = bestCase(v);
    if (p.maxWalkMinutes != null && bc.minWalkMinutes > p.maxWalkMinutes) {
      reasons.push("Shortest walk is about " + bc.minWalkMinutes + " min");
    }

    if (p.seatingIntegratedOnly || p.sightlineClearOnly || p.companionRequired) {
      var hasSeatOption = v.sections.some(function (s) {
        if (p.seatingIntegratedOnly && s.accessibleSeating !== "integrated") return false;
        if (p.sightlineClearOnly && s.sightline !== "clear") return false;
        if (p.companionRequired && !s.companionSeating) return false;
        return true;
      });
      if (!hasSeatOption) reasons.push("No seating option matches your seating preferences");
    }

    return { isMatch: reasons.length === 0, reasons: reasons };
  }

  /* ---------- exertion ---------- */

  var EXERTION_SCORE = { low: 0, medium: 1, high: 2 };

  function computeExertion(totalM, maxIncline, totalStairs, v, crowdId) {
    var crowd = CROWD_LEVELS.filter(function (c) { return c.id === crowdId; })[0] || CROWD_LEVELS[1];
    var minutes = Math.round(totalM / 60);

    var score = EXERTION_SCORE[v.climate.exertionBaseline] || 0;
    if (minutes >= 25) score += 2;
    else if (minutes >= 15) score += 1;
    if (maxIncline >= 6) score += 1;
    if (totalStairs >= 15) score += 1;
    score += crowd.factor;

    var tier = score >= 4 ? "high" : score >= 2 ? "moderate" : "low";

    var bits = ["about " + Math.max(minutes, 1) + " minute" + (minutes === 1 ? "" : "s") + " of walking"];
    if (maxIncline >= 6) bits.push("a sustained climb");
    if (totalStairs >= 15) bits.push(totalStairs + " stairs");

    var climateClause = v.climate.type === "outdoor-full-sun" ? "in full outdoor sun"
      : v.climate.type === "outdoor-shaded" ? "outdoors, mostly shaded"
      : v.climate.type === "outdoor-mixed" ? "outdoors, mixed sun and shade"
      : "indoors, air conditioned";

    var crowdClause = crowd.id === "packed" ? "with a sold-out crowd expected"
      : crowd.id === "light" ? "with a light crowd expected"
      : "";

    var tail = tier === "low" ? "Shouldn't raise your body temperature much."
      : tier === "moderate" ? "Likely to raise your body temperature — plan a rest partway."
      : "Likely to raise your body temperature quickly. Plan rest stops and hydration.";

    var parts = [bits.join(", "), climateClause];
    if (crowdClause) parts.push(crowdClause);

    return { tier: tier, sentence: "Roughly " + parts.join(", ") + ". " + tail };
  }

  /* ---------- navigation ---------- */

  function show(viewName) {
    $("view-venues").hidden = viewName !== "venues";
    $("view-route").hidden = viewName !== "route";
    window.scrollTo(0, 0);
  }

  document.addEventListener("click", function (e) {
    var nav = e.target.closest("[data-nav]");
    if (nav) {
      e.preventDefault();
      show(nav.getAttribute("data-nav"));
    }
  });

  /* ---------- stride selector ---------- */

  function buildStride() {
    var sel = $("stride-select");
    sel.innerHTML = "";
    STRIDE_PRESETS.forEach(function (p) {
      var o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.label;
      sel.appendChild(o);
    });
    sel.value = state.strideId;
    sel.addEventListener("change", function () {
      state.strideId = sel.value;
      localStorage.setItem("approach.stride", sel.value);
      updateStrideNote();
      if (state.venueId) renderRoute();
    });
    updateStrideNote();
  }

  function updateStrideNote() {
    $("stride-note").textContent = stride().meters.toFixed(2) + " m per step";
  }

  /* ---------- profile filter ---------- */

  function buildProfile() {
    $("env-indoor").checked = state.profile.environments.indoor;
    $("env-outdoor").checked = state.profile.environments.outdoor;
    $("env-mixed").checked = state.profile.environments.mixed;

    var sizeSel = $("size-select");
    sizeSel.innerHTML = "";
    SIZE_ORDER.forEach(function (cat) {
      var o = document.createElement("option");
      o.value = cat;
      o.textContent = "Up to " + SIZE_LABELS[cat];
      sizeSel.appendChild(o);
    });
    sizeSel.value = state.profile.maxSize;

    $("walktime-select").value = state.profile.maxWalkMinutes == null ? "" : String(state.profile.maxWalkMinutes);

    $("seat-integrated").checked = state.profile.seatingIntegratedOnly;
    $("seat-sightline").checked = state.profile.sightlineClearOnly;
    $("seat-companion").checked = state.profile.companionRequired;

    $("profile-panel").addEventListener("change", function () {
      state.profile.environments.indoor = $("env-indoor").checked;
      state.profile.environments.outdoor = $("env-outdoor").checked;
      state.profile.environments.mixed = $("env-mixed").checked;
      state.profile.maxSize = sizeSel.value;
      var walk = $("walktime-select").value;
      state.profile.maxWalkMinutes = walk === "" ? null : Number(walk);
      state.profile.seatingIntegratedOnly = $("seat-integrated").checked;
      state.profile.sightlineClearOnly = $("seat-sightline").checked;
      state.profile.companionRequired = $("seat-companion").checked;
      saveProfile();
      buildVenues();
    });
  }

  /* ---------- venue list ---------- */

  function venueCard(v, isMatch, reasons) {
    var li = document.createElement("li");
    if (!isMatch) li.className = "venue-mismatch";
    var btn = document.createElement("button");
    btn.className = "venue-card";
    btn.innerHTML =
      '<h3>' + v.name + '</h3>' +
      '<p class="sub">' + v.kind + ' · ' + v.city + '</p>' +
      '<p class="blurb">' + v.note + '</p>' +
      '<div class="card-badges">' +
        '<span class="trust ' + v.trust + '">' + trustLabel(v.trust) + '</span>' +
        (isMatch
          ? '<span class="profile-match yes">Matches your profile</span>'
          : '<span class="profile-match no">' + reasons.join(" · ") + '</span>') +
      '</div>';
    btn.addEventListener("click", function () { openVenue(v.id); });
    li.appendChild(btn);
    return li;
  }

  function buildVenues() {
    var ul = $("venue-list");
    ul.innerHTML = "";

    var matches = [], others = [];
    VENUES.forEach(function (v) {
      var m = matchesProfile(v);
      (m.isMatch ? matches : others).push({ v: v, reasons: m.reasons });
    });

    matches.forEach(function (entry) { ul.appendChild(venueCard(entry.v, true, [])); });

    if (others.length) {
      var head = document.createElement("li");
      head.className = "venue-group-head";
      head.textContent = "Doesn't match your profile";
      ul.appendChild(head);
      others.forEach(function (entry) { ul.appendChild(venueCard(entry.v, false, entry.reasons)); });
    }
  }

  /* ---------- accessibility passport ---------- */

  function passportItem(title, detail, tags) {
    return '<div class="passport-item">' +
      '<div class="passport-item-head"><span class="passport-name">' + title + '</span></div>' +
      (detail ? '<p class="passport-detail">' + detail + '</p>' : '') +
      (tags && tags.length ? '<div class="passport-tags">' + tags.join("") + '</div>' : '') +
      '</div>';
  }

  function communityNotes(v, category) {
    var notes = v.communityNotes && v.communityNotes[category];
    if (!notes || !notes.length) return "";
    return notes.map(function (n) {
      return '<div class="passport-item community">' +
        '<div class="passport-item-head"><span class="passport-name">' + escapeHtml(n.text) + '</span>' +
        '<span class="tag community-tag">Community-added</span></div></div>';
    }).join("");
  }

  function renderParking(v) {
    var rows = v.origins.map(function (o) {
      var t = segmentTotals(o.segments);
      var tags = ['<span class="tag">' + o.kind + '</span>'];
      if (originIsDropoff(o)) tags.push('<span class="tag rest">Drop-off to door</span>');
      tags.push(t.stairs === 0
        ? '<span class="tag rest">Step-free</span>'
        : '<span class="tag stairs">' + t.stairs + ' stairs</span>');
      return passportItem(o.name, Math.round(t.meters) + " m to the doors", tags);
    }).join("") + communityNotes(v, "parking");
    $("parking-list").innerHTML = rows || '<div class="empty">No parking areas recorded yet.</div>';
  }

  function renderElevators(v) {
    var rows = v.elevators.map(function (e) {
      var tags = [e.public ? '<span class="tag rest">Public</span>' : '<span class="tag">Staff-operated</span>'];
      return passportItem(e.location, e.servesLevels, tags);
    }).join("") + communityNotes(v, "elevator");
    $("elevator-list").innerHTML = rows || '<div class="empty">No elevators reported. Assume this venue is not step-free.</div>';
  }

  function renderRestrooms(v) {
    var rows = v.restrooms.map(function (r) {
      var tags = [r.accessibleStalls > 0
        ? '<span class="tag rest">' + r.accessibleStalls + ' accessible stall' + (r.accessibleStalls === 1 ? '' : 's') + '</span>'
        : '<span class="tag stairs">No confirmed accessible stall</span>'];
      if (r.sharedQueue) tags.push('<span class="tag">Shared queue</span>');
      return passportItem(r.location, r.notes, tags);
    }).join("") + communityNotes(v, "restroom");
    $("restroom-list").innerHTML = rows || '<div class="empty">No restrooms recorded yet.</div>';
  }

  function renderSeating(v) {
    var rows = v.sections.map(function (s) {
      var tags = [
        s.accessibleSeating === "integrated"
          ? '<span class="tag rest">Integrated seating</span>'
          : '<span class="tag">Segregated platform</span>',
        s.sightline === "clear"
          ? '<span class="tag rest">Clear sightline</span>'
          : '<span class="tag stairs">Sightline can be obstructed</span>',
        s.companionSeating
          ? '<span class="tag rest">Companion seat available</span>'
          : '<span class="tag">No companion seat</span>'
      ];
      return passportItem(s.name, s.relativeToStage, tags);
    }).join("") + communityNotes(v, "seating");
    $("seating-list").innerHTML = rows || '<div class="empty">No seating areas recorded yet.</div>';
  }

  /* ---------- venue detail ---------- */

  function openVenue(id) {
    state.venueId = id;
    var v = venue();
    state.originId = v.origins[0].id;
    state.sectionId = v.sections[0].id;
    state.detours = [];
    state.crowdLevel = "typical";

    $("venue-name").textContent = v.name;
    $("venue-kind").textContent = v.kind;
    $("venue-city").textContent = v.city;
    $("venue-note").textContent = v.note;
    $("venue-trust").innerHTML =
      '<span class="trust ' + v.trust + '">' + trustLabel(v.trust) + '</span>' +
      '<p class="venue-meta" style="margin-top:8px">Surveyed ' + v.surveyed + '</p>';

    var envLabel = v.environment === "indoor" ? "Indoor" : v.environment === "outdoor" ? "Outdoor" : "Mixed indoor/outdoor";
    var factsAll = v.facts.concat([
      ["Venue type", SIZE_LABELS[v.sizeCategory] + " · " + envLabel],
      ["Typical climate", v.climate.description]
    ]);
    var facts = $("venue-facts");
    facts.innerHTML = "";
    factsAll.forEach(function (f) {
      var d = document.createElement("div");
      d.innerHTML = "<dt>" + f[0] + "</dt><dd>" + f[1] + "</dd>";
      facts.appendChild(d);
    });

    renderParking(v);
    renderElevators(v);
    renderRestrooms(v);
    renderSeating(v);

    fillSelect($("origin-select"), v.origins.map(function (o) {
      return { value: o.id, label: o.name + " (" + o.kind + ")" };
    }), state.originId);

    fillSelect($("section-select"), v.sections.map(function (s) {
      return { value: s.id, label: s.name + " — " + s.level };
    }), state.sectionId);

    var dl = $("detour-list");
    dl.innerHTML = "";
    v.detours.forEach(function (d) {
      var label = document.createElement("label");
      label.className = "chk";
      label.innerHTML = '<input type="checkbox" value="' + d.id + '"> ' + d.name;
      dl.appendChild(label);
    });

    $("stub-msg").textContent = "";
    renderReports(v);
    renderRoute();
    show("route");
  }

  function fillSelect(sel, items, value) {
    sel.innerHTML = "";
    items.forEach(function (i) {
      var o = document.createElement("option");
      o.value = i.value;
      o.textContent = i.label;
      sel.appendChild(o);
    });
    sel.value = value;
  }

  $("origin-select").addEventListener("change", function (e) {
    state.originId = e.target.value;
    renderRoute();
  });
  $("section-select").addEventListener("change", function (e) {
    state.sectionId = e.target.value;
    renderRoute();
  });
  $("detour-list").addEventListener("change", function () {
    state.detours = Array.prototype.slice
      .call(document.querySelectorAll("#detour-list input:checked"))
      .map(function (i) { return i.value; });
    renderRoute();
  });

  /* ---------- crowdsourcing forms ---------- */

  $("passport-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var v = venue();
    if (!v) return;
    var category = $("passport-category").value;
    var textField = $("passport-text");
    var text = textField.value.trim();
    if (!text) return;

    v.communityNotes = v.communityNotes || { parking: [], elevator: [], restroom: [], seating: [] };
    v.communityNotes[category].push({ text: text });
    textField.value = "";

    if (category === "parking") renderParking(v);
    else if (category === "elevator") renderElevators(v);
    else if (category === "restroom") renderRestrooms(v);
    else if (category === "seating") renderSeating(v);

    $("stub-msg").textContent = "Added to the " + category + " section above.";
  });

  $("report-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var v = venue();
    if (!v) return;
    var textField = $("report-text");
    var text = textField.value.trim();
    if (!text) return;

    var today = new Date().toISOString().slice(0, 10);
    v.reports.unshift({ date: today, tag: $("report-tag").value, who: "You", text: text });
    textField.value = "";
    renderReports(v);

    $("stub-msg").textContent = "Report added below. Thanks for confirming the route.";
  });

  /* ---------- route assembly ---------- */

  function assemble() {
    var v = venue();
    var origin = v.origins.filter(function (o) { return o.id === state.originId; })[0];
    var section = v.sections.filter(function (s) { return s.id === state.sectionId; })[0];

    var groups = [
      { title: "Getting in — from " + origin.name, legs: origin.segments },
      { title: "Inside — to " + section.name, legs: section.segments }
    ];

    state.detours.forEach(function (id) {
      var d = v.detours.filter(function (x) { return x.id === id; })[0];
      if (!d) return;
      groups.push({
        title: "Round trip — " + d.name,
        legs: [{
          name: d.name + " and back",
          meters: d.meters * 2,
          stairs: d.stairs * 2,
          incline: d.incline,
          surface: "Round trip from your seat",
          rests: 0,
          note: d.note
        }]
      });
    });

    return groups;
  }

  function renderRoute() {
    var groups = assemble();
    var v = venue();
    var totalM = 0, totalStairs = 0, maxIncline = 0, rests = 0, longestDry = 0, run = 0;

    groups.forEach(function (g) {
      g.legs.forEach(function (l) {
        totalM += l.meters;
        totalStairs += l.stairs;
        maxIncline = Math.max(maxIncline, l.incline);
        rests += l.rests;
        run += l.meters;
        if (l.rests > 0) { longestDry = Math.max(longestDry, run); run = 0; }
      });
    });
    longestDry = Math.max(longestDry, run);

    var minutes = Math.max(Math.round(totalM / 60), totalM > 0 ? 1 : 0);

    $("totals").innerHTML =
      stat("Steps", steps(totalM), "") +
      stat("Walk time", minutes, "min") +
      stat("Distance", Math.round(totalM), "m") +
      stat("Stairs", totalStairs, totalStairs === 1 ? "step" : "steps") +
      stat("Steepest grade", maxIncline, "%") +
      stat("Places to rest", rests, "");

    renderExertion(totalM, maxIncline, totalStairs, v);
    renderFlags(totalStairs, maxIncline, longestDry);
    renderLegs(groups);
  }

  function stat(k, v, u) {
    return '<div class="stat"><span class="k">' + k + '</span>' +
      '<span class="v">' + v + (u ? '<span class="u">' + u + '</span>' : '') + '</span></div>';
  }

  function flag(kind, title, body) {
    return '<div class="flag ' + kind + '"><div><span class="ftitle">' + title +
      '</span><span class="fbody">' + body + '</span></div></div>';
  }

  function renderFlags(stairs, incline, dry) {
    var out = [];

    if (stairs === 0) {
      out.push(flag("good", "Step free", "No stairs anywhere on this route."));
    } else {
      out.push(flag("alert", stairs + " stairs on this route",
        "Check the segments below for which ones have a handrail or an elevator alternative."));
    }

    if (incline >= 6) {
      out.push(flag("caution", "Sustained climb of " + incline + "%",
        "Steep enough to raise your body temperature and your heart rate."));
    }

    if (dry >= 200) {
      out.push(flag("caution", "Longest stretch without a place to sit: " + Math.round(dry) + " m",
        "About " + steps(dry) + " steps with nowhere to stop."));
    }

    $("flags").innerHTML = out.join("");
  }

  function renderExertion(totalM, maxIncline, totalStairs, v) {
    var ex = computeExertion(totalM, maxIncline, totalStairs, v, state.crowdLevel);
    var box = $("exertion");
    box.className = "exertion " + ex.tier;
    box.innerHTML =
      '<div class="exertion-head">' +
        '<span class="exertion-tier">' + ex.tier + ' exertion</span>' +
        '<label class="exertion-crowd">Expected crowd' +
          '<select id="crowd-select"></select>' +
        '</label>' +
      '</div>' +
      '<p class="exertion-sentence">' + ex.sentence + '</p>';

    var sel = $("crowd-select");
    CROWD_LEVELS.forEach(function (c) {
      var o = document.createElement("option");
      o.value = c.id;
      o.textContent = c.label;
      sel.appendChild(o);
    });
    sel.value = state.crowdLevel;
    sel.addEventListener("change", function () {
      state.crowdLevel = sel.value;
      renderRoute();
    });
  }

  function renderLegs(groups) {
    var ol = $("route");
    ol.innerHTML = "";

    groups.forEach(function (g) {
      var head = document.createElement("li");
      head.className = "leg-group";
      head.textContent = g.title;
      ol.appendChild(head);

      g.legs.forEach(function (l) {
        var li = document.createElement("li");
        var cls = "leg";
        if (l.stairs > 0) cls += " stairs";
        else if (l.incline >= 5) cls += " climb";
        li.className = cls;

        var tags = [];
        if (l.stairs > 0) tags.push('<span class="tag stairs">' + l.stairs + ' stairs</span>');
        if (l.incline >= 3) tags.push('<span class="tag climb">' + l.incline + '% grade</span>');
        if (l.rests > 0) tags.push('<span class="tag rest">' + l.rests + ' place' + (l.rests > 1 ? 's' : '') + ' to sit</span>');
        if (l.surface) tags.push('<span class="tag">' + l.surface + '</span>');

        li.innerHTML =
          '<div class="leg-head">' +
            '<span class="leg-name">' + l.name + '</span>' +
            '<span class="leg-count">' + steps(l.meters) + ' steps · ' +
              Math.round(l.meters) + ' m · ' + feet(l.meters) + ' ft</span>' +
          '</div>' +
          '<div class="leg-tags">' + tags.join("") + '</div>' +
          (l.note ? '<p class="leg-note">' + l.note + '</p>' : '');

        ol.appendChild(li);
      });
    });
  }

  /* ---------- reports ---------- */

  function renderReports(v) {
    var box = $("reports");
    if (!v.reports.length) {
      box.innerHTML = '<div class="empty">No reports yet. If you visit, you can be the first to confirm or correct these numbers.</div>';
      return;
    }
    box.innerHTML = v.reports.map(function (r) {
      return '<div class="report">' +
        '<div class="report-meta"><span>' + escapeHtml(r.date) + '</span>' +
        '<span class="tag">' + escapeHtml(r.tag) + '</span><span>' + escapeHtml(r.who) + '</span></div>' +
        '<p>' + escapeHtml(r.text) + '</p></div>';
    }).join("");
  }

  /* ---------- init ---------- */

  buildStride();
  buildProfile();
  buildVenues();
  show("venues");
})();
