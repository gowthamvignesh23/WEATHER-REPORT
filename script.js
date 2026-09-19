// ---- Weather code → icon + label (Open-Meteo WMO codes) ----
  const WMO = {
    0:  ['☀️', 'Clear sky'],
    1:  ['🌤️', 'Mainly clear'],
    2:  ['⛅', 'Partly cloudy'],
    3:  ['☁️', 'Overcast'],
    45: ['🌫️', 'Fog'],
    48: ['🌫️', 'Depositing rime fog'],
    51: ['🌦️', 'Light drizzle'],
    53: ['🌦️', 'Drizzle'],
    55: ['🌦️', 'Dense drizzle'],
    61: ['🌧️', 'Light rain'],
    63: ['🌧️', 'Rain'],
    65: ['🌧️', 'Heavy rain'],
    71: ['🌨️', 'Light snow'],
    73: ['🌨️', 'Snow'],
    75: ['❄️', 'Heavy snow'],
    80: ['🌦️', 'Rain showers'],
    81: ['🌧️', 'Rain showers'],
    82: ['⛈️', 'Violent showers'],
    95: ['⛈️', 'Thunderstorm'],
    96: ['⛈️', 'Thunderstorm w/ hail'],
    99: ['⛈️', 'Severe thunderstorm']
  };

  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const $ = (id) => document.getElementById(id);
  const statusEl = $('status');
  const resultEl = $('result');
  const searchForm = $('searchForm');
  const cityInput = $('cityInput');
  const searchBtn = $('searchBtn');
  const locateBtn = $('locateBtn');

  function showStatus(msg, isError=false){
    resultEl.classList.remove('visible');
    statusEl.textContent = msg;
    statusEl.classList.add('visible');
    statusEl.classList.toggle('is-error', isError);
  }

  function showResult(){
    statusEl.classList.remove('visible');
    resultEl.classList.add('visible');
  }

  const NETWORK_HINT = 'Could not reach the weather service. If you\'re viewing this inside a chat preview, download the file and open it directly in your browser instead — chat previews often block outside network requests.';

  function friendlyError(err){
    // A blocked/failed fetch throws a generic TypeError in most browsers.
    if(err instanceof TypeError){
      return new Error(NETWORK_HINT);
    }
    return err;
  }

  async function geocodeCity(name){
    let res;
    try{
      res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`);
    }catch(err){
      throw friendlyError(err);
    }
    if(!res.ok) throw new Error(NETWORK_HINT);
    const data = await res.json();
    if(!data.results || data.results.length === 0) throw new Error('City not found. Try another spelling.');
    return data.results[0];
  }

  async function fetchWeather(lat, lon){
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
      `&timezone=auto&forecast_days=6`;
    let res;
    try{
      res = await fetch(url);
    }catch(err){
      throw friendlyError(err);
    }
    if(!res.ok) throw new Error(NETWORK_HINT);
    return res.json();
  }

  function renderPlace(place){
    const region = [place.admin1, place.country].filter(Boolean).join(', ');
    $('placeName').textContent = place.name;
    $('placeMeta').textContent = region || '—';
  }

  function renderCurrent(current){
    const [icon, label] = WMO[current.weather_code] || ['—', 'Unknown'];
    $('tempNow').innerHTML = `${Math.round(current.temperature_2m)}<sup>°C</sup>`;
    $('conditionIcon').textContent = icon;
    $('conditionLabel').textContent = label;
    $('feelsLike').textContent = `${Math.round(current.apparent_temperature)}°C`;
    $('wind').textContent = `${Math.round(current.wind_speed_10m)} km/h`;
    $('humidity').textContent = `${current.relative_humidity_2m}%`;
  }

  function renderForecast(daily){
    const row = $('forecastRow');
    row.innerHTML = '';
    // skip index 0 (today), show next 5 days
    for(let i = 1; i <= 5; i++){
      const date = new Date(daily.time[i]);
      const [icon] = WMO[daily.weather_code[i]] || ['—'];
      const hi = Math.round(daily.temperature_2m_max[i]);
      const lo = Math.round(daily.temperature_2m_min[i]);
      const el = document.createElement('div');
      el.className = 'forecast__day';
      el.innerHTML = `
        <div class="d">${dayNames[date.getDay()]}</div>
        <div class="i">${icon}</div>
        <div class="t">${hi}° <span>${lo}°</span></div>
      `;
      row.appendChild(el);
    }
  }

  async function loadByCoords(lat, lon, place){
    try{
      const weather = await fetchWeather(lat, lon);
      if(place) renderPlace(place);
      renderCurrent(weather.current);
      renderForecast(weather.daily);
      showResult();
    }catch(err){
      showStatus(err.message || 'Something went wrong. Please try again.', true);
    }
  }

  async function loadByCity(name){
    try{
      searchBtn.disabled = true;
      showStatus('Searching…');
      const place = await geocodeCity(name);
      await loadByCoords(place.latitude, place.longitude, place);
    }catch(err){
      showStatus(err.message || 'Something went wrong. Please try again.', true);
    }finally{
      searchBtn.disabled = false;
    }
  }

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = cityInput.value.trim();
    if(name) loadByCity(name);
  });

  locateBtn.addEventListener('click', () => {
    if(!navigator.geolocation){
      showStatus('Geolocation is not supported by your browser.', true);
      return;
    }
    showStatus('Finding your location…');
    navigator.geolocation.getCurrentPosition(
      (pos) => loadByCoords(pos.coords.latitude, pos.coords.longitude, null),
      () => showStatus('Could not get your location. Try searching a city instead.', true)
