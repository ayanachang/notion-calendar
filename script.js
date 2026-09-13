const CLIENT_ID = "928433799084-c29ucuoj1597np6lcarbqtf0if47j3on.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/calendar.events.readonly";

let tokenClient;
let accessToken = null;

let currentWeek = new Date();
currentWeek.setHours(0, 0, 0, 0);

const calendarEl = document.getElementById("calendar");
const weekTitleEl = document.getElementById("week-title");
const upcomingEl = document.getElementById("upcoming-events");
const connectButton = document.getElementById("connect");


// -----------------------------
// GOOGLE CALENDAR SETUP
// -----------------------------

function initializeGoogle() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: async (response) => {
      if (response.error) {
        console.error(response);
        return;
      }

      accessToken = response.access_token;

      connectButton.textContent = "Calendar connected ✓";

      await loadCalendars();
    }
  });
}


// -----------------------------
// CONNECT BUTTON
// -----------------------------

connectButton.addEventListener("click", () => {
  if (!tokenClient) {
    alert("Google Calendar is still loading. Please try again.");
    return;
  }

  tokenClient.requestAccessToken({
    prompt: accessToken ? "" : "consent"
  });
});


// -----------------------------
// GET ALL CALENDARS
// -----------------------------

async function loadCalendars() {
  try {
    const response = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error("Could not load calendars.");
    }

    const data = await response.json();

    const calendars = data.items || [];

    await loadEvents(calendars);

  } catch (error) {
    console.error(error);
    upcomingEl.innerHTML =
      "<p class='loading'>Couldn't load your calendars.</p>";
  }
}


// -----------------------------
// GET EVENTS FROM ALL CALENDARS
// -----------------------------

async function loadEvents(calendars) {
  const start = new Date(currentWeek);
  start.setDate(start.getDate() - start.getDay() + 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const timeMin = start.toISOString();
  const timeMax = end.toISOString();

  let allEvents = [];

  for (const calendar of calendars) {

    try {
      const url =
        `https://www.googleapis.com/calendar/v3/calendars/` +
        `${encodeURIComponent(calendar.id)}/events` +
        `?timeMin=${encodeURIComponent(timeMin)}` +
        `&timeMax=${encodeURIComponent(timeMax)}` +
        `&singleEvents=true` +
        `&orderBy=startTime`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!response.ok) continue;

      const data = await response.json();

      const events = (data.items || []).map(event => ({
        ...event,
        calendarName: calendar.summary,
        calendarColor: calendar.backgroundColor
      }));

      allEvents = allEvents.concat(events);

    } catch (error) {
      console.error(error);
    }
  }

  renderCalendar(allEvents);
  renderUpcoming(allEvents);
}


// -----------------------------
// RENDER WEEK
// -----------------------------

function renderCalendar(events) {

  calendarEl.innerHTML = "";

  const weekStart = new Date(currentWeek);

  const dayOfWeek = weekStart.getDay();

  const difference = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  weekStart.setDate(weekStart.getDate() + difference);

  weekTitleEl.textContent =
    `${formatDate(weekStart)} – ${formatDate(
      new Date(weekStart.getTime() + 6 * 86400000)
    )}`;

  const dayNames = [
    "MON",
    "TUE",
    "WED",
    "THU",
    "FRI",
    "SAT",
    "SUN"
  ];

  for (let i = 0; i < 7; i++) {

    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);

    const dayBox = document.createElement("div");
    dayBox.className = "day";

    if (isToday(day)) {
      dayBox.classList.add("today");
    }

    dayBox.innerHTML = `
      <div class="day-name">${dayNames[i]}</div>
      <div class="day-number">${day.getDate()}</div>
    `;

    const daysEvents = events.filter(event => {

      const eventStart =
        event.start.dateTime || event.start.date;

      const eventDate = new Date(eventStart);

      return (
        eventDate.getFullYear() === day.getFullYear() &&
        eventDate.getMonth() === day.getMonth() &&
        eventDate.getDate() === day.getDate()
      );
    });

    daysEvents.forEach(event => {

      const eventBox = document.createElement("div");

      eventBox.className = "event";

      const start =
        event.start.dateTime
          ? new Date(event.start.dateTime)
          : null;

      const time = start
        ? start.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit"
          })
        : "All day";

      eventBox.innerHTML = `
        <strong>${escapeHtml(event.summary || "Untitled")}</strong>
        <br>
        ${time}
      `;

      dayBox.appendChild(eventBox);
    });

    calendarEl.appendChild(dayBox);
  }
}


// -----------------------------
// UPCOMING EVENTS
// -----------------------------

function renderUpcoming(events) {

  upcomingEl.innerHTML = "";

  if (!events.length) {
    upcomingEl.innerHTML =
      "<p class='loading'>No events this week ♡</p>";
    return;
  }

  events.slice(0, 8).forEach(event => {

    const box = document.createElement("div");

    box.className = "upcoming-event";

    const date =
      event.start.dateTime || event.start.date;

    const formattedDate =
      new Date(date).toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric"
      });

    box.innerHTML = `
      <div class="event-date">${formattedDate}</div>
      <strong>${escapeHtml(event.summary || "Untitled")}</strong>
    `;

    upcomingEl.appendChild(box);
  });
}


// -----------------------------
// WEEK NAVIGATION
// -----------------------------

document.getElementById("prev-week").addEventListener("click", () => {

  currentWeek.setDate(currentWeek.getDate() - 7);

  if (accessToken) {
    loadCalendars();
  }
});


document.getElementById("next-week").addEventListener("click", () => {

  currentWeek.setDate(currentWeek.getDate() + 7);

  if (accessToken) {
    loadCalendars();
  }
});


document.getElementById("today").addEventListener("click", () => {

  currentWeek = new Date();
  currentWeek.setHours(0, 0, 0, 0);

  if (accessToken) {
    loadCalendars();
  }
});


// -----------------------------
// HELPERS
// -----------------------------

function isToday(date) {

  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}


function formatDate(date) {

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric"
  });
}


function escapeHtml(text) {

  const div = document.createElement("div");

  div.textContent = text;

  return div.innerHTML;
}


// -----------------------------
// START GOOGLE AUTH
// -----------------------------

window.addEventListener("load", () => {

  if (typeof google !== "undefined") {
    initializeGoogle();
  }

});