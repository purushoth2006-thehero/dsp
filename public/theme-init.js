// Set the theme before the page paints, so there is no flash of the wrong colours.
(function () {
  var saved
  try { saved = localStorage.getItem('dsp-theme') } catch { saved = undefined }
  var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  var theme = saved === 'light' || saved === 'dark' ? saved : (dark ? 'dark' : 'light')
  document.documentElement.setAttribute('data-theme', theme)
})()
