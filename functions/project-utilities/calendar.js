const { google } = require("googleapis");
const timeZone = "Atlantic/Canary";
const timeZoneNumber = 1;
const timeZoneOffset = "+01:00";
const serviceAccount = require("../credentials/googleCalendarKey.json");
const serviceAccountAuth = new google.auth.JWT({
  email: serviceAccount.client_email,
  key: serviceAccount.private_key,
  scopes: "https://www.googleapis.com/auth/calendar",
});
const calendar = google.calendar("v3");

async function createCalendarEventReservation(
  dateIn,
  dateOut,
  customerName,
  numPeople,
  prefOutside,
  reservationID,
  calendarID
) {
  return new Promise((resolve, reject) => {
    calendar.events.list(
      {
        auth: serviceAccountAuth,
        calendarId: calendarID,
        timeMin: dateIn.toISOString(),
        timeMax: dateOut.toISOString(),
      },
      (err, calendarResponse) => {
        if (err) {
          reject(err);
        } else {
          createReservationOnCalendar(
            dateIn,
            dateOut,
            customerName,
            numPeople,
            prefOutside,
            reservationID,
            calendarID
          ).then((data) => resolve(data));
        }
      }
    );
  });
}

async function createReservationOnCalendar(
  dateIn,
  dateOut,
  customerName,
  numPeople,
  prefOutside,
  reservationID,
  calendarID
) {
  return calendar.events
    .insert({
      auth: serviceAccountAuth,
      calendarId: calendarID,
      resource: {
        summary: `${customerName} (${numPeople}) ${prefOutside ? "⬆️" : "⬇️"}`,
        description: `Numero de personas: ${numPeople}\nPreferencia: ${
          prefOutside ? "terraza" : "interior"
        }\nCodigo de reserva: ${reservationID}`,
        start: { dateTime: dateIn },
        end: { dateTime: dateOut },
      },
    })
    .then((data) => data.data.id);
}

function deleteAllReservationFromCalendar(calendarId) {
  try {
    calendar.events.list(
      {
        auth: serviceAccountAuth,
        calendarId: calendarId,
        timeMin: new Date("2020-01-01").toISOString(),
        timeMax: new Date("2030-01-01").toISOString(),
      },
      (err, calendarResponse) => {
        if (!err) {
          var eventos = calendarResponse.data.items;
          eventos.forEach((e) => {
            deleteReservationFromCalendar(calendarId, e.id);
          });
        }
      }
    );
  } catch (err) {}
}

function deleteReservationFromCalendar(calendarId, eventId) {
  var params = {
    auth: serviceAccountAuth,
    calendarId: calendarId,
    eventId: eventId,
  };
  calendar.events.delete(params, function (err) {
    if (err) {
      return;
    }
  });
}

function addMonths(dateObj, monthsToAdd) {
  return new Date(dateObj.setMonth(dateObj.getMonth() + monthsToAdd));
}

function convertParametersDate(date, time) {
  return new Date(
    Date.parse(
      date.split("T")[0] +
        "T" +
        (time.split("T")[1].substr(0, 8) + timeZoneOffset)
    )
  );
}

function addHours(dateObj, hoursToAdd) {
  return new Date(new Date(dateObj).setHours(dateObj.getHours() + hoursToAdd));
}

function getLocaleTimeString(dateObj) {
  return dateObj.toLocaleTimeString("en-US", {
    hour: "numeric",
    hour12: true,
    timeZone: timeZone,
  });
}

function getLocaleDateString(dateObj, Intl) {
  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(dateObj);
}

module.exports = {
  timeZoneNumber,
  deleteReservationFromCalendar,
  createCalendarEventReservation,
  convertParametersDate,
  addHours,
  addMonths,
  getLocaleTimeString,
  getLocaleDateString,
  deleteAllReservationFromCalendar,
};
