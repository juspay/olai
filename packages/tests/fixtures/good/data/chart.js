// The page's own program, in a file beside it. Everything this draws was
// missing from the preview before the rule of 2026-08-16: the seal admitted one
// script by hash and this was not it, so `quarter.html` was a heading over an
// empty box.
var months = [["Jul", 62], ["Aug", 148], ["Sep", 205], ["Oct", 117]]
var chart = document.getElementById("chart")
months.forEach(function (month) {
  var bar = document.createElement("div")
  bar.className = "bar"
  bar.style.height = month[1] + "px"
  bar.innerHTML = "<span>£" + month[1] + "k</span><em>" + month[0] + "</em>"
  chart.appendChild(bar)
})
document.getElementById("probe").textContent =
  "drawn by this file's own JavaScript, from data/chart.js, in an origin that is nobody's"
