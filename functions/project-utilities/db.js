const admin = require("firebase-admin");
const serviceAccount = require("../credentials/firebaseAdminKey.json");
const shortid = require("shortid");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "YOUR DATA BASE URL",
});
const db = admin.database();

function arrayChecker(firstArray, secondArray) {
  return secondArray.every((v) => firstArray.includes(v));
}

function getFilteredByIngredients(menus, ingredientsRequest) {
  var filteredMenu = [];
  var ingredientsMenu;
  menus.forEach((menu) => {
    ingredientsMenu = menu.ingredients.map(
      (ingredientObject) => ingredientObject.name
    );
    if (arrayChecker(ingredientsMenu, ingredientsRequest)) {
      filteredMenu.push(menu);
    }
  });
  return filteredMenu;
}

function getFilteredByAllergens(menus, allergensRequest) {
  var filteredMenu = [];
  var allergensMenu;
  menus.forEach((menu) => {
    allergensMenu = menu.allergens.map((allergenObject) => allergenObject.name);
    if (arrayChecker(allergensMenu, allergensRequest)) {
      filteredMenu.push(menu);
    }
  });
  return filteredMenu;
}

function getPhaseInfoByNumber(phaseNumber) {
  let info = {};
  switch (phaseNumber) {
    case 0:
      info.phase = phaseNumber;
      info.maxPeople = 0;
      info.inside = 0;
      info.outside = 0;
    case 1:
      info.phase = phaseNumber;
      info.maxPeople = 10;
      info.inside = 0;
      info.outside = 0.5;
      break;
    case 2:
      info.phase = phaseNumber;
      info.maxPeople = 15;
      info.inside = 0.4;
      info.outside = 0.5;
      break;
    case 3:
      info.phase = phaseNumber;
      info.maxPeople = 15;
      info.inside = 0.5;
      info.outside = 0.5;
      break;
    default:
      info.phase = phaseNumber;
      info.maxPeople = 15;
      info.inside = 1;
      info.outside = 1;
      break;
  }
  return info;
}

function scheduleFormat(
  mOpen,
  mClose,
  tuOpen,
  tuClose,
  wOpen,
  wClose,
  thOpen,
  thClose,
  fOpen,
  fClose,
  saOpen,
  saClose,
  suOpen,
  suClose
) {
  return {
    mon: {
      open: mOpen,
      close: mClose,
    },
    tue: {
      open: tuOpen,
      close: tuClose,
    },
    wed: {
      open: wOpen,
      close: wClose,
    },
    thu: {
      open: thOpen,
      close: thClose,
    },
    fri: {
      open: fOpen,
      close: fClose,
    },
    sat: {
      open: saOpen,
      close: saClose,
    },
    sun: {
      open: suOpen,
      close: suClose,
    },
  };
}

function reservationFormat(
  customerName,
  establishmentName,
  prefOutside,
  date,
  numPeople
) {
  let fullDate = date.toISOString();
  return {
    customerName: customerName,
    establishmentName: establishmentName,
    id: shortid.generate(),
    duration: 1,
    prefOutside: prefOutside,
    place: prefOutside ? "out" : "in",
    year: date.toISOString().substring(0, 4),
    month: date.toISOString().substring(5, 7),
    day: date.toISOString().substring(8, 10),
    hour: date.toISOString().substring(11, 13),
    fullDate: fullDate,
    numPeople: numPeople,
  };
}

function establishmentFormat(
  phase,
  address,
  calendarId,
  tablesCapacity,
  capacityInside,
  capacityOutside,
  email,
  name,
  phone,
  urlImg,
  web
) {
  let outside = capacityOutside > 0 ? true : false;
  return {
    phase: phase,
    address: address,
    calendarId: calendarId,
    tablesCapacity: tablesCapacity,
    capacity: { inside: capacityInside, outside: capacityOutside },
    email: email,
    id: shortid.generate(),
    name: name,
    outside: outside,
    phone: phone,
    urlImg: urlImg,
    web: web,
  };
}

async function getIngredientsList() {
  let ingredients = [];
  let establishments = Object.values(await getEstablishments());
  establishments.forEach((establishment) =>
    Object.values(establishment.menus).forEach((menu) =>
      Object.values(menu.ingredients).forEach((ingredient) =>
        ingredients.every((e) => e != ingredient.name)
          ? ingredients.push(ingredient.name)
          : null
      )
    )
  );
  return ingredients;
}

async function getAllergensList() {
  let allergens = [];
  let establishments = Object.values(await getEstablishments());
  establishments.forEach((establishment) =>
    Object.values(establishment.menus).forEach((menu) =>
      Object.values(menu.allergens).forEach((allergen) =>
        allergens.every((e) => e != allergen.name)
          ? allergens.push(allergen.name)
          : null
      )
    )
  );
  return allergens;
}

function menuFormat(
  allergensNameArray,
  ingredientsNameArray,
  availability,
  name,
  price,
  urlImg
) {
  let menusFormat = {
    id: shortid.generate(),
    allergens: [],
    availability: availability,
    ingredients: [],
    name: name,
    price: price,
    urlImg: urlImg,
  };
  allergensNameArray.forEach((allergenName) =>
    menusFormat.allergens.push({ name: allergenName })
  );
  ingredientsNameArray.forEach((ingredientName) =>
    menusFormat.ingredients.push({ name: ingredientName })
  );
  return menusFormat;
}

function checkIfAccessCodeIsCorrect(clientAccessCode) {
  return getQuery("accessCode").then(
    (dbAccessCode) => dbAccessCode === clientAccessCode
  );
}

function checkIfReservationExist(establishmentID, reservationID) {
  return getQuery(
    `establishments/${establishmentID}/reservations/all/${reservationID}`
  ).then((reservation) =>
    reservation != null ? reservation.id == reservationID : null
  );
}

function addNewEstablishmentToDB(establishment) {
  let id = establishment.id;
  db.ref("establishments").child(id).set(establishment);
}

function addNewReservationToDB(establishmentID, reservationFormat) {
  let year = reservationFormat.year;
  let month = reservationFormat.month;
  let day = reservationFormat.day;
  let hour = reservationFormat.hour;
  let place = reservationFormat.place;
  let id = reservationFormat.id;
  db.ref(`/establishments/${establishmentID}/reservations/all`)
    .child(id)
    .set(reservationFormat);
  db.ref(
    `/establishments/${establishmentID}/reservations/date/${year}/${month}/${day}/${hour}/${place}`
  )
    .child(id)
    .set(reservationFormat);
}

function addScheduleToEstablishment(establishmentID, scheduleFormat) {
  db.ref(`/establishments/${establishmentID}`)
    .child("schedule")
    .set(scheduleFormat);
}

function addMenuToEstablishment(establishmentID, menuFormat) {
  let id = menuFormat.id;
  db.ref(`/establishments/${establishmentID}/menus/`).child(id).set(menuFormat);
}

function deleteAllReservationFromEstablishmentDB(establishmentID) {
  return db
    .ref(`establishments/${establishmentID}/reservations`)
    .remove()
    .then(() => true)
    .catch(() => false);
}

function deleteReservationFromEstablishmentDB(establishmentID, reservationID) {
  let refDate;
  let refAll = `establishments/${establishmentID}/reservations/all/${reservationID}`;
  return getQuery(refAll)
    .then(
      (r) =>
        (refDate = `/establishments/${establishmentID}/reservations/date/${r.year}/${r.month}/${r.day}/${r.hour}/${r.place}`)
    )
    .then(() => {
      db.ref(refDate).remove();
      db.ref(refAll).remove();
      return true;
    })
    .catch(() => false);
}

async function getQuery(newRef, newQuery) {
  let query = newQuery == null ? db.ref(newRef) : db.ref(newRef).newQuery;
  return query.once("value").then((snapshot) => snapshot.val());
}

function getEstablishments() {
  return getQuery("establishments").then((establishmentsObject) =>
    Object.values(establishmentsObject)
  );
}

function getEstablishmentsName() {
  return getEstablishments().then((establishments) =>
    establishments.map((establishment) => establishment.name)
  );
}

function getCalendarsID() {
  return getEstablishments().then((establishments) =>
    establishments.filter((e) => e != null).map((e) => e.calendarId)
  );
}

function getEstablishmentNameByID(establishmentID) {
  return getEstablishmentByID(establishmentID).then(
    (establishment) => establishment.name
  );
}

function getReservationByID(establishmentID, reservationID) {
  return getQuery(
    `/establishments/${establishmentID}/reservations/all`
  ).then((reservations) =>
    Object.values(reservations).find(
      (reservation) => reservation.id == reservationID
    )
  );
}

function getEstablishmentByID(establishmentID) {
  return getQuery(`establishments/${establishmentID}`).then(
    (establishment) => establishment
  );
}

function getMenuByID(establishmentID, menuID) {
  return getEstablishmentByID(establishmentID).then((establishment) =>
    Object.values(establishment.menus).find((e) => e.id == menuID)
  );
}

async function getEstablishmentInfoByID(establishmentID) {
  return getEstablishmentByID(establishmentID).then((e) => {
    let day = new Date().toString().substring(0, 3).toLowerCase();
    let establishmentInfo = {
      name: e.name,
      urlImg: e.urlImg,
      phone: e.phone,
      phase: e.phase,
      schedule: {
        open: e.schedule[day].open,
        close: e.schedule[day].close,
      },
      outside: e.outside,
      address: e.address,
      urlImg: e.urlImg,
      phase: e.phase,
    };
    return establishmentInfo;
  });
}

function getCalendarIDByID(establishmentID) {
  return getEstablishmentByID(establishmentID).then(
    (establishment) => establishment.calendarId
  );
}

function getFilteredCapacityByID(
  establishmentPhase,
  establishmentCapacityInside,
  establishmentCapacityOutside,
  establishmentTablesCapacity,
  reservationsIn,
  reservationsOut
) {
  let phase = establishmentPhase;
  let phaseInfo = getPhaseInfoByNumber(phase);
  let inside = Math.floor(
    establishmentCapacityInside * phaseInfo.inside - reservationsIn
  );
  let outside = Math.floor(
    establishmentCapacityOutside * phaseInfo.outside - reservationsOut
  );
  let filtered = {
    phase: phase,
    inside: inside,
    outside: outside,
    total: inside + outside,
    tablesCapacity: establishmentTablesCapacity,
    maxPeople: phaseInfo.maxPeople,
  };
  return filtered;
}

function getEstablishmentScheduleByID(establishmentID) {
  return getQuery(`/establishments/${establishmentID}/schedule`).then(
    (schedule) => schedule
  );
}

module.exports = {
  arrayChecker,
  menuFormat,
  scheduleFormat,
  establishmentFormat,
  reservationFormat,
  checkIfAccessCodeIsCorrect,
  checkIfReservationExist,
  addNewEstablishmentToDB,
  addNewReservationToDB,
  addScheduleToEstablishment,
  addMenuToEstablishment,
  deleteAllReservationFromEstablishmentDB,
  deleteReservationFromEstablishmentDB,
  getQuery,
  getIngredientsList,
  getAllergensList,
  getEstablishments,
  getEstablishmentsName,
  getCalendarsID,
  getEstablishmentNameByID,
  getEstablishmentScheduleByID,
  getReservationByID,
  getEstablishmentByID,
  getEstablishmentInfoByID,
  getCalendarIDByID,
  getFilteredCapacityByID,
  getMenuByID,
  getPhaseInfoByNumber,
  getFilteredByIngredients,
  getFilteredByAllergens,
};
