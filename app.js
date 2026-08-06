(function () {
  "use strict";

  var state = {
    strideId: localStorage.getItem("approach.stride") || "average",
    venueId: null,
    originId: null,
    sectionId: null,
    detours: []
  };

  var $ = function (id) { return document.getElementById(id); };

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
      return;
    }
    var stub = e.target.closest("[data-stub]");
    if (stub) {
      var kind = stub.getAttribute("data-stub");
      $("stub-msg").textContent = kind === "record"
        ? "Not built yet. This would track your steps and elevation as you walk, then submit the route for review."
        : "Not built yet. This would open a short form: what changed, which segment, and today's date.";
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

  /* ---------- venue list ---------- */

  function buildVenues() {
    var ul = $("venue-list");
    ul.innerHTML = "";
    VENUES.forEach(function (v) {
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.className = "venue-card";
      btn.innerHTML =
        '<h3>' + v.name + '</h3>' +
        '<p class="sub">' + v.kind + ' · ' + v.city + '</p>' +
        '<p class="blurb">' + v.note + '</p>' +
        '<span class="trust ' + v.trust + '">' + trustLabel(v.trust) + '</span>';
      btn.addEventListener("click", function () { openVenue(v.id); });
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }

  /* ---------- venue detail ---------- */

  function openVenue(id) {
    state.venueId = id;
    var v = venue();
    state.originId = v.origins[0].id;
    state.sectionId = v.sections[0].id;
    state.detours = [];

    $("venue-name").textContent = v.name;
    $("venue-kind").textContent = v.kind;
    $("venue-city").textContent = v.city;
    $("venue-note").textContent = v.note;
    $("venue-trust").innerHTML =
      '<span class="trust ' + v.trust + '">' + trustLabel(v.trust) + '</span>' +
      '<p class="venue-meta" style="margin-top:8px">Surveyed ' + v.surveyed + '</p>';

    var facts = $("venue-facts");
    facts.innerHTML = "";
    v.facts.forEach(function (f) {
      var d = document.createElement("div");
      d.innerHTML = "<dt>" + f[0] + "</dt><dd>" + f[1] + "</dd>";
      facts.appendChild(d);
    });

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

    $("totals").innerHTML =
      stat("Steps", steps(totalM), "") +
      stat("Distance", Math.round(totalM), "m") +
      stat("Stairs", totalStairs, totalStairs === 1 ? "step" : "steps") +
      stat("Steepest grade", maxIncline, "%") +
      stat("Places to rest", rests, "");

    renderFlags(totalStairs, maxIncline, longestDry, totalM);
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

  function renderFlags(stairs, incline, dry, totalM) {
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

    var minutes = Math.round(totalM / 60);
    out.push(flag("", "Roughly " + (minutes < 2 ? "2" : minutes) + " minutes at an unhurried pace",
        "Assumes stopping when you need to. Add time for crowds at the doors."));

    $("flags").innerHTML = out.join("");
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
        '<div class="report-meta"><span>' + r.date + '</span>' +
        '<span class="tag">' + r.tag + '</span><span>' + r.who + '</span></div>' +
        '<p>' + r.text + '</p></div>';
    }).join("");
  }

  /* ---------- init ---------- */

  buildStride();
  buildVenues();
  show("venues");
})();
