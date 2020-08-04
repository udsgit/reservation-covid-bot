const Intl = require("intl");
const db = require("./db");
const calendar = require("./calendar");
const { google } = require("calendar-link");
const regExp = /[\w\d_-]{7,14}/;

var answers = {
  intents: {
    Fallback: {
      default: {
        es: ["Default Fallback"],
        en: [],
      },
      accessverified: {
        es: ["accessverified Fallback"],
        en: [],
      },
      testcontext: {
        es: ["Fallback Prueba Test 1"],
        en: [],
      },
      welcometestcontext: {
        es: ["welcome test context response"],
        en: [],
      },
    },
    Test: {
      es: ["test test test", "testttttttttttttttt", "TEST TEST TEST"],
      en: [],
    },
    Prueba: {
      es: [
        "Esto es un mensaje de prueba",
        "Mensaje de prueba...",
        "Mensajeeeeeeeeeee de prueba",
      ],
      en: [
        "This is a test message",
        "test message...",
        "test messageeeeeeeeeee",
      ],
    },
    Welcome: {
      es: [
        "Bienvenid@, para continuar ingrese el código de acceso, por favor.",
        "¡Hola!, para poder ofrecerle mis servicios, necesito el código de acceso.",
        "Salud@s, para poder ayudarlo es necesario que introduzca el código de acceso.",
      ],
      en: [],
    },
    VerifyAccess: {
      es: [
        "El código de acceso que ha introducido no es válido, si no sabe como conseguirlo, escriba ayuda.",
        "Sú código no es válido, si no lo conoce, puede escribir ayuda.",
        "Código incorrecto, si no conoce el código, escriba ayuda",
      ],
      en: [],
    },
  },
};

//Devuelve un mensaje aleatorio según su intent y región
function replyRandomMessage(agent) {
  let context = getContext(agent);
  let intent = agent.intent;
  let language = agent.locale;
  let min = 0;
  let max =
    intent == "Fallback"
      ? answers.intents[intent][context][language].length - 1
      : answers.intents[intent][language].length - 1;
  let random = Math.floor(Math.random() * (max - min + 1)) + min;
  return intent == "Fallback"
    ? answers.intents[intent][context][language][random]
    : answers.intents[intent][language][random];
}

function getContext(agent) {
  let contexts = Object.keys(agent.context.contexts).filter(
    (e) => e != "__system_counters__"
  );
  let fallbackType = "default";
  if (db.arrayChecker(contexts, ["accessverified"])) {
    fallbackType = "accessverified";
  }
  return fallbackType;
}

//Devuelve el formato correcto de customAnswer
function answer(answer, status = true) {
  return {
    data: answer,
    status: status,
  };
}
//Devuelve la respuesta al comprobar el código de acceso (Promise)
function verifyAccessCode(agent) {
  return db
    .checkIfAccessCodeIsCorrect(agent.parameters.accessCode)
    .then((accessCode) => {
      if (accessCode) {
        return establishmentList();
      } else {
        return answer(replyRandomMessage(agent), false);
      }
    });
}

//Devuelve el listado de establecimientos (Promise)
function establishmentList() {
  return db.getEstablishments().then((e) => answer(e));
}

async function checkAvailabilityReservation(agent) {
  const establishmentID = agent.context.get("establishment").parameters
    .establishmentID;
  const customerName = agent.parameters.customerName.name;
  const numPeople = agent.parameters.numPeople;
  const prefOutside = agent.parameters.prefOutside;
  const establishment = await db.getEstablishmentByID(establishmentID);
  const calendarId = establishment.calendarId;
  const establishmentName = establishment.name;
  const capacity = establishment.capacity;
  const place = prefOutside ? "Interior" : "Exterior";

  const appointmentDuration = 1;
  const dateTimeStart = calendar.convertParametersDate(
    agent.parameters.date,
    agent.parameters.time
  );
  const dateTimeEnd = calendar.addHours(dateTimeStart, appointmentDuration);
  const appointmentTimeString = calendar.getLocaleTimeString(dateTimeStart);
  const appointmentDateString = calendar.getLocaleDateString(
    dateTimeStart,
    Intl
  );
  const DBDate = calendar.addHours(dateTimeStart, calendar.timeZoneNumber);

  let reservationFormat = db.reservationFormat(
    customerName,
    establishmentName,
    prefOutside,
    DBDate,
    numPeople
  );
  //crear evento calendario
  calendar.createCalendarEventReservation(
    dateTimeStart,
    dateTimeEnd,
    customerName,
    numPeople,
    place,
    establishmentName,
    calendarId,
    capacity
  );
  //guardar reserva en ddbb
  makeReservation(establishtmentID, reservationFormat);
  return answer(
    `Perfecto ${customerName}, tu cita ha sido fijada para la siguiente fecha ${appointmentDateString} a las ${appointmentTimeString}. Este es el ID de la reserva '${reservationFormat.id}' , guárdalo. Hasta luego. 👋`
  );
}

function listEstablishmentData(establishmentID) {
  return db
    .getEstablishmentInfoByID(establishmentID)
    .then((establishment) => answer(establishment));
}

function addTimeZoneNumberToDate(fullDate) {
  return new Date(calendar.addHours(fullDate, calendar.timeZoneNumber));
}

function deleteAllReservationEvents() {
  var array = [
    "1s0e0d2n6t1hoonct7jtre2788@group.calendar.google.com",
    "ab68hvmfkqu477vnb5gc66ps6o@group.calendar.google.com",
    "5pe2s3sjh1929mtbb6vu2cvju8@group.calendar.google.com",
  ];
  array.forEach((e) => {
    calendar.deleteAllReservationFromCalendar(e);
  });
}

function querySchedule(establishmentID) {
  return db
    .getEstablishmentInfoByID(establishmentID)
    .then((e) => answer(e.schedule));
}

function queryPhase(establishmentID) {
  return db
    .getEstablishmentInfoByID(establishmentID)
    .then((e) => answer(e.phase));
}

function checkTerrace(establishmentID) {
  return db
    .getEstablishmentByID(establishmentID)
    .then((e) => answer(e.outside));
}

function getEstablishmentByID(establishmentID) {
  return db.getEstablishmentByID(establishmentID).then((e) => answer(e));
}

function getMenuByID(establishmentID, menuID) {
  return db.getMenuByID(establishmentID, menuID).then((e) => answer(e));
}

function filterMenusByIngredient(menus, ingredientsRequest) {
  return db.getFilteredByIngredients(menus, ingredientsRequest);
}

function filterMenusByAllergen(menus, allergensRequest) {
  return db.getFilteredByAllergens(menus, allergensRequest);
}

function getTodaysMenu(menus) {
  let dia = new Date().getDate();
  menu = dia % menus.length;
  return answer(menus[menu]);
}

function getTextInfoIfParametersAreMissing(
  customerName,
  date,
  time,
  numPeople,
  prefOutside
) {
  let textInfo;
  let requiredMissingSlots = [];
  !customerName ? requiredMissingSlots.push("su nombre") : "";
  !date ? requiredMissingSlots.push("la fecha") : "";
  !time ? requiredMissingSlots.push("la hora") : "";
  !numPeople ? requiredMissingSlots.push("el número de personas") : "";

  nameText = !customerName ? `` : ` ${capitalizeFirstLetter(customerName)}`;

  switch (requiredMissingSlots.length) {
    case 1:
      textInfo = `De acuerdo${nameText}, para finalizar me faltaría ${requiredMissingSlots[0]}`;
      break;
    case 2:
      textInfo = `Entendido, digame ${requiredMissingSlots[0]} y ${requiredMissingSlots[1]}`;
      break;
    case 3:
      textInfo = `Perfecto, ahora indiqueme ${requiredMissingSlots[0]}, ${requiredMissingSlots[1]} y ${requiredMissingSlots[2]}`;
      break;
    case 4:
      textInfo = `Para realizar la reserva me tiene que indicar ${
        requiredMissingSlots[0]
      }, ${requiredMissingSlots[1]}, ${requiredMissingSlots[2]} ${
        !prefOutside
          ? `,${requiredMissingSlots[3]} y opcionalmente si prefiere en la terraza o no`
          : `y ${requiredMissingSlots[3]}`
      }`;
      break;
    default:
      textInfo = "";
      break;
  }
  return textInfo;
}

function getCalendarLink(tittle, description, start, duration) {
  return google(
    (event = {
      title: tittle,
      description: description,
      start: start,
      duration: [duration, "hour"],
    })
  );
}

async function getTextInfoIfParametersAreNotValid(
  date,
  time,
  numPeople,
  phase,
  schedule,
  capacity,
  tablesCapacity,
  outside,
  prefOutside,
  textInfo,
  customerName
) {
  let requiredNotValidSlots = [];

  if (date) {
    const dayName = new Date(date).toString().substring(0, 3).toLowerCase();
    const daySchedule = schedule[dayName];
    let dayNameText;
    switch (dayName) {
      case "mon":
        dayNameText = "lunes";
        break;
      case "tue":
        dayNameText = "martes";
        break;
      case "wed":
        dayNameText = "miércoles";
        break;
      case "thu":
        dayNameText = "jueves";
        break;
      case "fri":
        dayNameText = "viernes";
        break;
      case "sat":
        dayNameText = "sábados";
        break;
      case "sun":
        dayNameText = "domingos";
        break;
      default:
        break;
    }

    new Date(date) < new Date()
      ? requiredNotValidSlots.push(`cambie la fecha, ya que ese día ya paso`)
      : new Date(date) > calendar.addMonths(new Date(), 3)
      ? requiredNotValidSlots.push(
          `elija una fecha más cercana ya que no aceptamos reservas mayores a 3 meses`
        )
      : !daySchedule.open
      ? requiredNotValidSlots.push(
          `cambie el día elegido porque los ${dayNameText} estamos cerrados, si quiere consultar nuestro horario completo puede preguntarme por los horarios`
        )
      : "";

    if (time) {
      let hour = parseInt(time.substring(11, 13));
      let minutes = parseInt(time.substring(14, 16));
      (hour < daySchedule.open || hour > daySchedule.close) &&
      daySchedule.open != false
        ? requiredNotValidSlots.push(
            `cambie la hora, ya que abrimos de ${daySchedule.open}:00 a ${daySchedule.close}:00`
          )
        : minutes != "00"
        ? requiredNotValidSlots.push(
            `cambie la hora, ya que solo gestionamos reservas en horas completas`
          )
        : "";
    }
  }

  let phaseInfo = await db.getPhaseInfoByNumber(phase);
  let capacityIn = Math.floor(capacity.inside * phaseInfo.inside);
  let capacityOut = Math.floor(capacity.outside * phaseInfo.outside);
  let tablesNeeded = Math.ceil(numPeople / tablesCapacity);

  if (prefOutside == "true" && tablesNeeded > capacityOut) {
    if (capacityOut == 0 && outside == false) {
      requiredNotValidSlots.push(
        `cambie su preferencia al interior, ya que nuestro local no dispone de terraza`
      );
    } else {
      requiredNotValidSlots.push(
        `reduzca el número de personas ya que debido a que aún nos encontramos en fase ${
          phaseInfo.phase
        }, nuestro aforo maximo en la terraza esta limitado a ${
          capacityOut * tablesCapacity
        } personas`
      );
    }
  } else if (prefOutside == "false" && tablesNeeded > capacityIn) {
    requiredNotValidSlots.push(
      `reduzca el número de personas ya que debido a que aún nos encontramos en fase ${
        phaseInfo.phase
      }, nuestro aforo maximo en el interior esta limitado a ${
        capacityIn * tablesCapacity
      } personas`
    );
  } else if (
    prefOutside == null &&
    tablesNeeded > capacityIn &&
    tablesNeeded > capacityOut
  ) {
    let textAforoIn =
      capacityIn == 0
        ? `no tenemos aforo disponible en el interior`
        : `nuestro aforo maximo en el interior es de ${
            capacityIn * tablesCapacity
          } personas`;
    let textAforoOut =
      capacityOut == 0
        ? `no tenemos aforo disponible en la terraza`
        : `nuestro aforo maximo en la terraza es de ${
            capacityOut * tablesCapacity
          } personas`;
    requiredNotValidSlots.push(
      `reduzca el número de personas ya que debido a que aún nos encontramos en fase ${phaseInfo.phase}, ${textAforoIn} y ${textAforoOut}`
    );
  } else if (numPeople > phaseInfo.maxPeople) {
    requiredNotValidSlots.push(
      `reduzca el numero de personas ya que supera el limite actual de la fase ${phaseInfo.phase} que es de ${phaseInfo.maxPeople} personas`
    );
  }

  nameText = !customerName ? `` : ` ${capitalizeFirstLetter(customerName)}`;
  switch (requiredNotValidSlots.length) {
    case 1:
      textInfo += textInfo
        ? `. También es necesario que ${requiredNotValidSlots[0]}.`
        : `Perfecto ${customerName}, solo faltaría que ${requiredNotValidSlots[0]}.`;
      break;
    case 2:
      textInfo += textInfo
        ? `. También hara falta que ${requiredNotValidSlots[0]} y que ${requiredNotValidSlots[1]}.`
        : `Genial, solo hara falta que ${requiredNotValidSlots[0]} y ${requiredNotValidSlots[1]}.`;
      break;
    default:
      textInfo += textInfo ? "." : "";
      break;
  }
  return textInfo;
}

async function slotFillingReservation(
  customerName,
  date,
  time,
  numPeople,
  prefOutside,
  establishmentID
) {
  time ? new Date(time).toISOString() : null;
  date ? new Date(date).toISOString() : null;

  const [
    phase,
    schedule,
    capacity,
    tablesCapacity,
    outside,
  ] = await db
    .getQuery(`/establishments/${establishmentID}`)
    .then((establishment) => [
      establishment.phase,
      establishment.schedule,
      establishment.capacity,
      establishment.tablesCapacity,
      establishment.outside,
    ]);
  let textInfo = getTextInfoIfParametersAreMissing(
    customerName,
    date,
    time,
    numPeople,
    prefOutside
  );
  textInfo = await getTextInfoIfParametersAreNotValid(
    date,
    time,
    numPeople,
    phase,
    schedule,
    capacity,
    tablesCapacity,
    outside,
    prefOutside,
    textInfo,
    customerName
  );

  return textInfo.length
    ? answer(textInfo, false)
    : answer(calendar.convertParametersDate(date, time), true);
}

function getTreeMaxDatesAvailable(
  reservations,
  dates,
  fullDate,
  hour,
  prefOutside,
  phase,
  inside,
  outside,
  tablesCapacity,
  tablesNeeded,
  schedule,
  add,
  newHour
) {
  let newDate;
  hour = parseInt(hour);
  if (dates.length == 3) {
    return;
  } else {
    if (add) {
      if (newHour < schedule.close) {
        newDate = calendar.addHours(fullDate, newHour - hour);
      } else {
        newHour = hour - 1;
        if (
          newHour > schedule.open &&
          calendar.addHours(fullDate, newHour - hour) > new Date()
        ) {
          newDate = calendar.addHours(fullDate, -1);
          add = false;
        } else {
          return;
        }
      }
    } else {
      if (
        newHour > schedule.open &&
        calendar.addHours(fullDate, newHour - hour) > new Date()
      ) {
        newDate = calendar.addHours(fullDate, newHour - hour);
      } else {
        return;
      }
    }

    newDateString = newDate.toISOString();

    let inLength = 0;
    if (reservations[newHour]) {
      if (reservations[newHour].in) {
        Object.values(reservations[newHour].in).forEach((reservation) => {
          inLength += Math.ceil(reservation.numPeople / tablesCapacity);
        });
      } else {
        inLength = 0;
      }
    } else {
      inLength = 0;
    }
    let outLength = 0;
    if (reservations[newHour]) {
      if (reservations[newHour].out) {
        Object.values(reservations[newHour].out).forEach((reservation) => {
          outLength += Math.ceil(reservation.numPeople / tablesCapacity);
        });
      } else {
        outLength = 0;
      }
    } else {
      outLength = 0;
    }

    let capacityFiltered = db.getFilteredCapacityByID(
      phase,
      inside,
      outside,
      tablesCapacity,
      inLength,
      outLength
    );
    let capacityOut = capacityFiltered.outside;
    let capacityIn = capacityFiltered.inside;
    if (prefOutside) {
      //pref exterior
      if (tablesNeeded > capacityOut) {
        //si Exterior lleno
        if (tablesNeeded > capacityIn) {
          //si interior lleno
          add ? newHour++ : newHour--;
          getTreeMaxDatesAvailable(
            reservations,
            dates,
            fullDate,
            hour,
            prefOutside,
            phase,
            inside,
            outside,
            tablesCapacity,
            tablesNeeded,
            schedule,
            add,
            newHour
          );
        } else {
          dates.push([newDateString, false]);
          add ? newHour++ : newHour--;
          getTreeMaxDatesAvailable(
            reservations,
            dates,
            fullDate,
            hour,
            prefOutside,
            phase,
            inside,
            outside,
            tablesCapacity,
            tablesNeeded,
            schedule,
            add,
            newHour
          );
        }
      } else {
        dates.push([newDateString, true]);
        add ? newHour++ : newHour--;
        getTreeMaxDatesAvailable(
          reservations,
          dates,
          fullDate,
          hour,
          prefOutside,
          phase,
          inside,
          outside,
          tablesCapacity,
          tablesNeeded,
          schedule,
          add,
          newHour
        );
      }
    } else if (prefOutside == false) {
      //pref interior
      if (tablesNeeded > capacityIn) {
        //si interior lleno
        if (tablesNeeded > capacityOut) {
          //si exterior lleno
          add ? newHour++ : newHour--;
          getTreeMaxDatesAvailable(
            reservations,
            dates,
            fullDate,
            hour,
            prefOutside,
            phase,
            inside,
            outside,
            tablesCapacity,
            tablesNeeded,
            schedule,
            add,
            newHour
          );
        } else {
          dates.push([newDateString, true]);
          add ? newHour++ : newHour--;
          getTreeMaxDatesAvailable(
            reservations,
            dates,
            fullDate,
            hour,
            prefOutside,
            phase,
            inside,
            outside,
            tablesCapacity,
            tablesNeeded,
            schedule,
            add,
            newHour
          );
        }
      } else {
        dates.push([newDateString, false]);
        add ? newHour++ : newHour--;
        getTreeMaxDatesAvailable(
          reservations,
          dates,
          fullDate,
          hour,
          prefOutside,
          phase,
          inside,
          outside,
          tablesCapacity,
          tablesNeeded,
          schedule,
          add,
          newHour
        );
      }
    } else if (prefOutside == null) {
      if (tablesNeeded > capacityIn) {
        if (tablesNeeded > capacityOut) {
          add ? newHour++ : newHour--;
          getTreeMaxDatesAvailable(
            reservations,
            dates,
            fullDate,
            hour,
            prefOutside,
            phase,
            inside,
            outside,
            tablesCapacity,
            tablesNeeded,
            schedule,
            add,
            newHour
          );
        } else {
          dates.push([newDateString, true]);
          add ? newHour++ : newHour--;
          getTreeMaxDatesAvailable(
            reservations,
            dates,
            fullDate,
            hour,
            prefOutside,
            phase,
            inside,
            outside,
            tablesCapacity,
            tablesNeeded,
            schedule,
            add,
            newHour
          );
        }
      } else {
        dates.push([newDateString, false]);
        add ? newHour++ : newHour--;
        getTreeMaxDatesAvailable(
          reservations,
          dates,
          fullDate,
          hour,
          prefOutside,
          phase,
          inside,
          outside,
          tablesCapacity,
          tablesNeeded,
          schedule,
          add,
          newHour
        );
      }
    }
  }
}

async function getWeeklySchedule(establishmentID) {
  let establishment = await db.getEstablishmentByID(establishmentID);
  let array = ["Nuestro horario semanal es el siguiente"];
  let arrayDias = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  for (i = 0; i < Object.keys(establishment.schedule).length; i++) {
    switch (arrayDias[i]) {
      case "mon":
        text = "Lunes";
        break;
      case "tue":
        text = "Martes";
        break;
      case "wed":
        text = "Miercoles";
        break;
      case "thu":
        text = "Jueves";
        break;
      case "fri":
        text = "Viernes";
        break;
      case "sat":
        text = "Sabado";
        break;
      case "sun":
        text = "Domingo";
        break;
      default:
    }
    if (establishment.schedule[arrayDias[i]].close != false) {
      array.push(
        `${text} abrimos de ${establishment.schedule[arrayDias[i]].open} a ${
          establishment.schedule[arrayDias[i]].close
        } ✔️`
      );
    } else {
      array.push(`${text} estamos cerrados ❌`);
    }
  }
  array.push("¿Desea reservar o realizar otras consultas?");
  return answer(array);
}

function getReservationOptionsText(
  options,
  prefOutside,
  date,
  time,
  agent,
  numPeople
) {
  let numDates = options.length;
  let optionsText =
    numDates > 1
      ? `pero no se preocupe, ya hemos consultado la disponibilidad y le ofrecemos estas ${numDates} opciones o tambien puede cambiar los datos que quiera y volveremos a consultarlo`
      : `pero no se preocupe, puede intentar reducir el número de personas o cambiar la fecha y volveremos a consultarlo`;
  let prefOutsideText =
    prefOutside == "true"
      ? " manteniendo su preferencia en la terraza"
      : prefOutside == "false"
      ? " manteniendo su preferencia en el interior"
      : "";
  let dateOptionsContext = {
    name: "dateoptions",
    lifespan: 50,
    parameters: {},
  };
  let originalfullDate = new Date(
    calendar.addHours(
      calendar.convertParametersDate(date, time),
      calendar.timeZoneNumber
    )
  );
  originalfullDate = originalfullDate.toISOString();
  let year = originalfullDate.substring(0, 4);
  let month = originalfullDate.substring(5, 7);
  let day = originalfullDate.substring(8, 10);
  let hour = originalfullDate.substring(11, 13);
  let minutes = originalfullDate.substring(14, 16);
  let optionText;
  let originalDateText = `${day}/${month}/${year} a las ${hour}:${minutes}`;
  let numPeopleText = numPeople > 1 ? `${numPeople} personas` : `una persona`;
  let dateOptions = [];
  let text = [];
  let title = `Lamentablemente no tenemos hueco disponible para el día ${originalDateText} para ${numPeopleText}${prefOutsideText}, ${optionsText}.`;
  options.forEach((option, i) => {
    option = {
      date: new Date(option[0]).toISOString(),
      prefOutside: option[1],
    };
    hour = option.date.substring(11, 13);
    minutes = option.date.substring(14, 16);
    optionText = `A las ${hour}:${minutes} en ${
      option.prefOutside ? "la terraza" : "el interior del local"
    }.`;
    dateOptions.push(option);
    text.push(`Opción ${i + 1}: ${optionText}`);
  });
  dateOptionsContext.parameters.options = dateOptions;
  agent.context.set(dateOptionsContext);
  let data = {
    title: title,
    text: text,
  };
  let bool = numDates > 0 ? true : false;
  return answer(data, bool);
}

function getConfirmReservationText(
  fullDate,
  prefOutside,
  numPeople,
  customerName
) {
  let year = fullDate.substring(0, 4);
  let month = fullDate.substring(5, 7);
  let day = fullDate.substring(8, 10);
  let hour = fullDate.substring(11, 13);
  let minutes = fullDate.substring(14, 16);

  dateText = `${day}/${month}/${year} a las ${hour}:${minutes}`;
  prefOutsideText =
    prefOutside == "false" ? `el interior del local` : `la terraza`;
  textPeople = numPeople > 1 ? `${numPeople} personas` : `una persona`;
  let text = `Perfecto ${capitalizeFirstLetter(
    customerName
  )}, ¿confirmas la reserva para el día ${dateText} en ${prefOutsideText} para ${textPeople}? si responde que "no" borraremos la reserva pero si cree que hay algún dato erroneo, puede decirnos el cambio y volveremos a consultarlo.`;
  return answer(text);
}

async function getAvailableDateOptions(
  fullDate,
  numPeople,
  prefOutside,
  establishmentID
) {
  fullDate = calendar.addHours(fullDate, calendar.timeZoneNumber);
  let nameDay = fullDate.toString().substring(0, 3).toLowerCase();
  let year = fullDate.toISOString().substring(0, 4);
  let month = fullDate.toISOString().substring(5, 7);
  let day = fullDate.toISOString().substring(8, 10);
  let hour = fullDate.toISOString().substring(11, 13);
  let schedule = await db.getQuery(
    `establishments/${establishmentID}/schedule/${nameDay}`
  );
  let establishment = await db.getEstablishmentByID(establishmentID);
  let phase = establishment.phase;
  let inside = establishment.capacity.inside;
  let outside = establishment.capacity.outside;
  let tablesCapacity = establishment.tablesCapacity;
  let tablesNeeded = Math.ceil(numPeople / tablesCapacity);
  let reservations = establishment.reservations
    ? establishment.reservations.date[year][month][day]
    : null;
  prefOutside =
    prefOutside == "true" ? true : prefOutside == "false" ? false : null;

  if (!reservations) {
    prefOutside == null ? (prefOutside = true) : null;
    return answer([fullDate, prefOutside], true);
  }
  dateString = fullDate.toISOString();
  let inLength = 0;
  if (reservations[hour]) {
    if (reservations[hour].in) {
      Object.values(reservations[hour].in).forEach((reservation) => {
        inLength += Math.ceil(reservation.numPeople / tablesCapacity);
      });
    } else {
      inLength = 0;
    }
  } else {
    inLength = 0;
  }
  let outLength = 0;
  if (reservations[hour]) {
    if (reservations[hour].out) {
      Object.values(reservations[hour].out).forEach((reservation) => {
        outLength += Math.ceil(reservation.numPeople / tablesCapacity);
      });
    } else {
      outLength = 0;
    }
  } else {
    outLength = 0;
  }

  let capacityFiltered = db.getFilteredCapacityByID(
    phase,
    inside,
    outside,
    tablesCapacity,
    inLength,
    outLength
  );
  let capacityOut = capacityFiltered.outside;
  let capacityIn = capacityFiltered.inside;
  console.log(
    `Fecha: ${fullDate}, Mesas: ${tablesNeeded}, in: ${capacityIn}, out: ${capacityOut}`
  );
  let dates = [];
  let add = true;
  let newHour = parseInt(hour) + 1;

  if (prefOutside) {
    //pref exterior
    if (tablesNeeded > capacityOut) {
      //si Exterior lleno
      if (tablesNeeded > capacityIn) {
        //si interior lleno
        getTreeMaxDatesAvailable(
          reservations,
          dates,
          fullDate,
          hour,
          prefOutside,
          phase,
          inside,
          outside,
          tablesCapacity,
          tablesNeeded,
          schedule,
          add,
          newHour
        );
        return answer(dates, false);
      } else {
        dates.push([dateString, false]);
        getTreeMaxDatesAvailable(
          reservations,
          dates,
          fullDate,
          hour,
          prefOutside,
          phase,
          inside,
          outside,
          tablesCapacity,
          tablesNeeded,
          schedule,
          add,
          newHour
        );
        return answer(dates, false);
      }
    } else {
      return answer([dateString, true], true); //fecha disponible, --> llamar a confirmar
    }
  } else if (prefOutside == false) {
    //pref interior
    if (tablesNeeded > capacityIn) {
      //si interior lleno
      if (tablesNeeded > capacityOut) {
        //si exterior lleno
        getTreeMaxDatesAvailable(
          reservations,
          dates,
          fullDate,
          hour,
          prefOutside,
          phase,
          inside,
          outside,
          tablesCapacity,
          tablesNeeded,
          schedule,
          add,
          newHour
        );
        return answer(dates, false);
      } else {
        dates.push([dateString, true]);
        getTreeMaxDatesAvailable(
          reservations,
          dates,
          fullDate,
          hour,
          prefOutside,
          phase,
          inside,
          outside,
          tablesCapacity,
          tablesNeeded,
          schedule,
          add,
          newHour
        );
        return answer(dates, false);
      }
    } else {
      return answer([dateString, false], true);
    }
  } else if (prefOutside == null) {
    if (tablesNeeded > capacityIn) {
      if (tablesNeeded > capacityOut) {
        getTreeMaxDatesAvailable(
          reservations,
          dates,
          fullDate,
          hour,
          prefOutside,
          phase,
          inside,
          outside,
          tablesCapacity,
          tablesNeeded,
          schedule,
          add,
          newHour
        );
        return answer(dates, false);
      } else {
        return answer([dateString, true], true);
      }
    } else {
      return answer([dateString, false], true);
    }
  }
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

async function makeReservation(
  date,
  prefOutside,
  numPeople,
  customerName,
  establishmentID
) {
  const [establishmentName, calendarID] = await db
    .getQuery(`/establishments/${establishmentID}`)
    .then((establishment) => [establishment.name, establishment.calendarId]);
  customerName = capitalizeFirstLetter(customerName);
  let reservationFormat = db.reservationFormat(
    customerName,
    establishmentName,
    prefOutside,
    date,
    numPeople
  );
  const dateIn = new Date(
    calendar.addHours(
      new Date(reservationFormat.fullDate),
      -calendar.timeZoneNumber
    )
  );
  const dateOut = calendar.addHours(dateIn, reservationFormat.duration);
  const reservationID = reservationFormat.id;
  let title = `Reserva en ${establishmentName}`;
  let description = `Titular de la reserva: ${customerName}\nNumero de personas: ${numPeople}\nPreferencia: ${
    prefOutside ? "terraza" : "interior"
  }\nCodigo de reserva: ${reservationID}`;
  let calendarLink = getCalendarLink(
    title,
    description,
    dateIn,
    reservationFormat.duration
  );
  let text = `Listo, su reserva se ha registrado para el día ${reservationFormat.day}/${reservationFormat.month}/${reservationFormat.year} a las ${reservationFormat.hour}:00, aquí tiene su código de reserva: ${reservationID}.`;
  let data = {
    text: text,
    link: calendarLink,
    helpMore: `¿Puedo ayudarle en algo más?`,
  };
  reservationFormat.calendarEventID = await calendar.createCalendarEventReservation(
    dateIn,
    dateOut,
    customerName,
    numPeople,
    prefOutside,
    reservationID,
    calendarID
  );
  db.addNewReservationToDB(establishmentID, reservationFormat);
  return answer(data);
}

function converToFullDate(date, time) {
  return calendar.convertParametersDate(date, time);
}

function deleteContexts(agent, ...contextsName) {
  contextsName.forEach((name) => agent.context.delete(name));
}

function renewContexts(agent, ...contextsName) {
  contextsName.forEach((name) =>
    agent.context.set({ name: name, lifespan: 50 })
  );
}

function setContext(agent, name, lifespan, parameters) {
  agent.context.set({
    name: name,
    lifespan: lifespan,
    parameters: parameters,
  });
}

function getIngredientsList() {
  return db.getIngredientsList().then((e) => answer(e));
}

function getAllergensList() {
  return db.getAllergensList().then((e) => answer(e));
}

function checkValidReservationDate(reservationFullDate, duration) {
  return new Date(reservationFullDate) > new Date();
}

async function verifyReservationID(establishmentID, reservationID) {
  if (reservationID && regExp.test(reservationID)) {
    if (await db.checkIfReservationExist(establishmentID, reservationID)) {
      const r = await db.getReservationByID(establishmentID, reservationID);
      if (checkValidReservationDate(r.fullDate, parseInt(r.duration))) {
        const data = {
          text: `Perfecto ${r.customerName}, ¿confirmas la anulación de la reserva para el día ${r.day}/${r.month}/${r.year} a las ${r.hour}:00?`,
          reservation: r,
        };
        return answer(data, true);
      } else {
        return answer(
          `Gracias por intentar anular su reserva ${r.customerName}, pero ya había caducado el ${r.day}/${r.month}/${r.year} a las ${r.hour}:00.`,
          false
        );
      }
    } else {
      return answer("Su codigo de reserva no es valido.", false);
    }
  } else {
    return answer(
      "Para cancelar una reserva, es necesario que introduzca un código de reserva.",
      false
    );
  }
}

async function deleteReservation(establishmentID, reservation) {
  const reservationID = reservation.id;
  const customerName = reservation.customerName;
  const calendarEventID = reservation.calendarEventID;
  const calendarID = await db.getCalendarIDByID(establishmentID);
  if (
    await db.deleteReservationFromEstablishmentDB(
      establishmentID,
      reservationID
    )
  ) {
    calendar.deleteReservationFromCalendar(calendarID, calendarEventID);
    return answer(
      `Listo ${customerName}, su reserva para el día ${reservation.day}/${reservation.month}/${reservation.year} a las ${reservation.hour}:00 se ha cancelado, ¡gracias por avisarnos!\n¿Puedo ayudarle en algo más?`,
      true
    );
  }
  return answer(
    `Vaya, en estos momentos no podemos cancelar su reserva ${customerName}, si es tan amable, intentelo en otro momento\n¿Puedo ayudarle en algo más?`,
    false
  );
}

module.exports = {
  getWeeklySchedule,
  deleteReservation,
  checkValidReservationDate,
  verifyReservationID,
  renewContexts,
  deleteContexts,
  setContext,
  getReservationOptionsText,
  getConfirmReservationText,
  addTimeZoneNumberToDate,
  capitalizeFirstLetter,
  converToFullDate,
  makeReservation,
  getAvailableDateOptions,
  slotFillingReservation,
  checkTerrace,
  establishmentList,
  verifyAccessCode,
  checkAvailabilityReservation,
  listEstablishmentData,
  querySchedule,
  replyRandomMessage,
  deleteAllReservationEvents,
  getEstablishmentByID,
  getMenuByID,
  queryPhase,
  filterMenusByIngredient,
  filterMenusByAllergen,
  getIngredientsList,
  getAllergensList,
  getTodaysMenu,
};
