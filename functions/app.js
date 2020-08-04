const express = require("express");
const utilities = require("project-utilities");
const { WebhookClient, Card } = require("dialogflow-fulfillment");
const {
  SimpleResponse,
  BasicCard,
  Image,
  Suggestions,
  LinkOutSuggestion,
  Table,
  Carousel,
  Permission,
} = require("actions-on-google");

function updateEntity(entityName, array) {
  const credentials = require("./credentials/googleCalendarKey.json");
  const dialogflow = require("dialogflow");
  const entitiesClient = new dialogflow.EntityTypesClient({
    credentials: credentials,
  });
  const projectId = "reservasbot-ujbcne";
  const agentPath = entitiesClient.projectAgentPath(projectId);
  entitiesClient
    .listEntityTypes({
      parent: agentPath,
    })
    .then((responses) => {
      for (let i = 0; i < responses[0].length; i++) {
        const entity = responses[0][i];
        if (entity.displayName === entityName) {
          return entity;
        }
      }
    })
    .then((entity) => {
      const updatedEntityList = [];
      array.data.forEach((e) => {
        updatedEntityList.push({
          value: e,
        });
      });
      entity.entities = updatedEntityList;
      const request = {
        entityType: entity,
        updateMask: {
          paths: ["entities"],
        },
      };
      return entitiesClient.updateEntityType(request);
    });
}

const app = express();

app.get("/", (req, res) => res.send("online"));
app.post("/dialogflow", express.json(), (req, res) => {
  const agent = new WebhookClient({
    request: req,
    response: res,
  });
  const conv = agent.conv();

  function informationAboutUserGoogleAssistant() {
    if (conv.user.name.display) {
      conv.ask(
        new SimpleResponse({
          speech: `De acuerdo ${conv.user.name.given} , ¿puedes darme el CÓDIGO DE ACCESO para seguir hablando contigo?`,
          text: `De acuerdo ${conv.user.name.given} , ¿puedes darme el 🔸CÓDIGO DE ACCESO🔸 para seguir hablando contigo?`,
        })
      );
    } else {
      conv.ask(
        new SimpleResponse({
          speech: `Entiendo , te volvere a preguntar cuando quieras reservar.  \nPor ahora para continuar interactuando contigo necesito que me digas el CÓDIGO DE ACCESO`,
          text: `Entiendo , te volvere a preguntar cuando quieras reservar.😅  \nPor ahora para continuar interactuando contigo necesito que me digas el 🔸CÓDIGO DE ACCESO🔸 👈`,
        })
      );
    }
    agent.add(conv);
  }

  function carouselOPTION(e) {
    if (agent.context.get("jupiter")) {
      agent.setFollowupEvent({
        name: "establishmentData",
        parameters: {
          establishmentID:
            e.context.contexts.actions_intent_option.parameters.OPTION,
        },
      });
    } else {
      agent.setFollowupEvent({
        name: "menuData",
        parameters: {
          menuID: e.context.contexts.actions_intent_option.parameters.OPTION,
        },
      });
    }
    agent.add("x"); // Necesario porque Google Assistant espera siempre una respuesta , por mas que no salga por pantalla.
  }

  async function menuData() {
    switch (agent.requestSource) {
      case "ACTIONS_ON_GOOGLE":
        let answer = await utilities.getMenuByID(
          agent.context.get("menu").parameters.establishmentID,
          agent.parameters.menuID
        );
        let menu = answer.data;
        conv.ask(`Ingredientes de ${menu.name}`);
        let rows = [];
        menu.ingredients.forEach((e) => rows.push([e.name, ""]));
        conv.ask(
          new Table({
            title: menu.name,
            subtitle: `${menu.price}€`,
            image: new Image({
              url: menu.urlImg,
              alt: menu.name,
            }),
            columns: ["INGREDIENTES", ""],
            rows: rows,
          })
        );
        conv.ask(new Suggestions(["Ir a menu", "Reservar"]));
        agent.add(conv);
        break;
      case "TELEGRAM":
      default:
        break;
    }
  }

  function welcomeGoogleAssistant() {
    const permissions = ["NAME"];
    let context = "Bienvenido, para una atención mas personalizada";
    const options = {
      context,
      permissions,
    };
    conv.ask(new Permission(options));
    agent.add(conv);
  }

  async function verifyAccess(agent) {
    let answer = await utilities.verifyAccessCode(agent);
    if (answer.status) {
      switch (agent.requestSource) {
        case "ACTIONS_ON_GOOGLE":
          items = {};
          answer.data.forEach((e) => {
            items[e.id] = {
              title: e.name,
              description: e.address,
              image: new Image({
                url: e.urlImg,
                alt: e.name,
              }),
            };
          });
          let nameGoogle = "";
          conv.user.name.given ? (nameGoogle = conv.user.name.given) : "";
          conv.ask(
            `<speak>Perfecto ${nameGoogle},  <break strength="medium"/> aquí tienes la lista de nuestros establecimientos. ¿En cual deseas reservar o realizar alguna consulta?</speak>`
          );
          conv.ask(
            new Carousel({
              title: "Establecimientos",
              items: items,
            })
          );
          agent.context.set({
            name: "jupiter",
            lifespan: 1,
            parameters: {
              "parameter-name": "parameter-value",
            },
          });
          agent.add(conv);
          break;
        case "TELEGRAM":
        default:
          let responses;
          if (!agent.context.session.includes("whatsapp")) {
            responses = [
              "Genial, tu código es correcto ✔️, estos son los establecimientos disponibles. ",
            ];
            answer.data.forEach((e, i) => {
              responses.push(`${i + 1}. ${e.name}.`);
            });
          } else {
            responses =
              "Genial, tu código es correcto ✔️, estos son los establecimientos disponibles. ";
            answer.data.forEach((e, i) => {
              responses += `\n${i + 1}. ${e.name}.`;
            });
          }
          agent.add(responses);
          break;
      }
    } else {
      switch (agent.requestSource) {
        case "TELEGRAM":
        case "ACTIONS_ON_GOOGLE":
        default:
          agent.add(answer.data);
          break;
      }
    }
  }

  async function establishments() {
    let answer = await utilities.establishmentList();
    switch (agent.requestSource) {
      case "ACTIONS_ON_GOOGLE":
        items = {};
        answer.data.forEach((e) => {
          items[e.id] = {
            title: e.name,
            description: e.address,
            image: new Image({
              url: e.urlImg,
              alt: e.name,
            }),
          };
        });
        conv.ask(
          `Aqui tienes la lista de establecimientos, ¿con cual deseas interactuar?`
        );
        conv.ask(
          new Carousel({
            title: "Establecimientos",
            items: items,
          })
        );
        agent.add(conv);
        agent.context.set({
          name: "jupiter",
          lifespan: 1,
          parameters: {
            "parameter-name": "parameter-value",
          },
        });
        break;
      case "TELEGRAM":
      default:
        let responses =
          "Aqui tienes la lista de establecimientos, ¿con cual deseas interactuar?\n";
        answer.data.forEach((e, i) => {
          responses += `\n${i + 1}. ${e.name}.`;
        });
        agent.add(responses);
        break;
    }
  }

  async function establishmentQuery() {
    let answer = await utilities.listEstablishmentData(
      agent.parameters.establishmentID
    );
    let establishment = answer.data;

    let scheduleText;
    if (establishment.schedule.open == false) {
      scheduleText = "Hoy estamos cerrados";
    } else {
      scheduleText = `El horario de hoy es de ${establishment.schedule.open}:00 - ${establishment.schedule.close}:00`;
    }

    switch (agent.requestSource) {
      case "TELEGRAM":
        agent.add(
          new Card({
            title: establishment.name,
            imageUrl: establishment.urlImg,
            text: `📞 ${establishment.phone}\n⌚${scheduleText}\nTerraza: ${
              establishment.outside ? "✔️" : "❌"
            }\n📍 ${establishment.address}\nFase: ${establishment.phase}`,
            buttonText: "Reservar",
            buttonUrl: "reservar",
          })
        );
        break;
      case "ACTIONS_ON_GOOGLE":
        let nameGoogle = "";
        conv.user.name.given
          ? (nameGoogle =
              conv.user.name.given + ',<break strength="medium"/> aquí')
          : (nameGoogle = "Aquí");
        conv.ask(
          `<speak> ${nameGoogle} tienes la información sobre` +
            establishment.name +
            ".  ¿Deseas reservar o realizar otras consultas? </speak>"
        );
        conv.ask(
          new BasicCard({
            text: `⌚${scheduleText}  \nTerraza: ${
              establishment.outside ? "✔️" : "❌"
            }  \n📍 ${establishment.address}  \nFase: ${establishment.phase}`,
            subtitle: `📞 ${establishment.phone}`,
            title: establishment.name,
            image: new Image({
              url: establishment.urlImg,
              alt: establishment.name,
            }),
          })
        );
        conv.ask(
          new Suggestions(["Deseo reservar", "Realizar otras consultas"])
        );
        agent.add(conv);
        break;
      default:
        if (!agent.context.session.includes("whatsapp")) {
          agent.add([
            establishment.name,
            `📞 ${establishment.phone}`,
            `⌚${scheduleText}`,
            `Terraza: ${establishment.outside ? "✔️" : "❌"}`,
            `📍 ${establishment.address}`,
            `\nFase: ${establishment.phase}`,
            "¿Desea gestionar una reserva u realizar otras consultas?",
          ]);
        } else {
          agent.add(
            `${establishment.name}\n📞 ${
              establishment.phone
            }\n⌚${scheduleText}\nTerraza: ${
              establishment.outside ? "✔️" : "❌"
            }\n📍 ${establishment.address}\nFase: ${
              establishment.phase
            }\n¿Desea gestionar una reserva u realizar otras consultas?`
          );
        }
        break;
    }
  }

  async function confirmReservationYes() {
    let [date, prefOutside, numPeople, customerName, establishmentID] = [
      new Date(agent.context.get("confirmreservation").parameters.date),
      agent.context.get("confirmreservation").parameters.prefOutside,
      agent.context.get("reservation").parameters.numPeople,
      agent.context.get("reservation").parameters.customerName.name,
      agent.context.get("reservation").parameters.establishmentID,
    ];
    utilities.deleteContexts(agent, "confirmreservation", "reservation");
    if (agent.requestSource == "ACTIONS_ON_GOOGLE" && conv.user.name.display) {
      customerName = conv.user.name.given;
    }
    utilities.setContext(agent, "exit", 50, {
      establishmentID: establishmentID,
    });
    let answer = await utilities.makeReservation(
      date,
      prefOutside,
      numPeople,
      customerName,
      establishmentID
    );
    let text = answer.data.text;
    let link = answer.data.link;
    let helpMore = answer.data.helpMore;
    switch (agent.requestSource) {
      case "TELEGRAM":
        let card = new Card(
          "Tambien aquí tiene un enlace para que lo guarde en Google Calendar"
        );
        card.setButton({
          text: "Google Calendar",
          url: link,
        });
        agent.add([text, card, helpMore]);
        break;
      case "ACTIONS_ON_GOOGLE":
        conv.ask(text);
        conv.ask(
          "Tambien aquí tiene un enlace para que lo guarde en su Calendario\n" +
            helpMore
        );
        conv.ask(
          new LinkOutSuggestion({
            name: "Añadir a calendario",
            url: link,
          })
        );
        agent.add(conv);
        break;
      default:
        if (!agent.context.session.includes("whatsapp")) {
          agent.add([
            text,
            `Tambien aquí tiene un enlace para que lo guarde en Google Calendar ${link}`,
            helpMore,
          ]);
        } else {
          agent.add(
            `${text}\nTambien aquí tiene un enlace para que lo guarde en Google Calendar ${link}\n${helpMore}`
          );
        }
        break;
    }
  }

  function confirmReservationNo(agent) {
    const establishmentID = agent.context.get("reservation").parameters
      .establishmentID;
    utilities.deleteContexts(agent, "confirmreservation", "reservation");
    utilities.setContext(agent, "exit", 50, {
      establishmentID: establishmentID,
    });
    const text = `Entendido, no hemos creado ninguna reserva, ¿Puedo ayudarle en algo más?`;
    switch (agent.requestSource) {
      case "TELEGRAM":
      case "ACTIONS_ON_GOOGLE":
      default:
        agent.add(text);
        break;
    }
  }

  async function reservation(agent) {
    utilities.deleteContexts(
      agent,
      "menu",
      "otherqueries",
      "terrace",
      "verified",
      "cancelreservation",
      "confirmreservation"
    );
    let [customerName, date, time, numPeople, establishmentID] = [
      agent.parameters.customerName.name,
      agent.parameters.date,
      agent.parameters.time,
      agent.parameters.numPeople,
      agent.context.get("reservation").parameters.establishmentID,
    ];
    if (numPeople) {
      numPeople = Math.abs(Math.floor(numPeople));
    }
    if (agent.requestSource == "ACTIONS_ON_GOOGLE" && conv.user.name.display) {
      customerName = conv.user.name.given;
    }
    let prefOutside =
      agent.parameters.prefOutside == "" ? null : agent.parameters.prefOutside;
    let answer = await utilities.slotFillingReservation(
      customerName,
      date,
      time,
      numPeople,
      prefOutside,
      establishmentID
    );
    let fullDate = answer.data;
    if (answer.status) {
      answer = await utilities.getAvailableDateOptions(
        fullDate,
        numPeople,
        prefOutside,
        establishmentID
      );
      if (answer.status) {
        let parameters = {
          date: answer.data[0],
          prefOutside: answer.data[1],
        };
        utilities.setContext(agent, "confirmreservation", 50, parameters);
        fullDate = new Date(answer.data[0]).toISOString();
        prefOutside = answer.data[1];
        answer = utilities.getConfirmReservationText(
          fullDate,
          prefOutside,
          numPeople,
          customerName
        );
        switch (agent.requestSource) {
          case "TELEGRAM":
          case "ACTIONS_ON_GOOGLE":
          default:
            agent.add(answer.data);
            break;
        }
      } else {
        let options = answer.data;
        answer = utilities.getReservationOptionsText(
          options,
          prefOutside,
          date,
          time,
          agent,
          numPeople
        );
        let title = answer.data.title;
        let text = answer.data.text;
        if (answer.status) {
          switch (agent.requestSource) {
            case "TELEGRAM":
            case "ACTIONS_ON_GOOGLE":
            default:
              agent.add(title);
              agent.add(text);
              break;
          }
        } else {
          switch (agent.requestSource) {
            case "TELEGRAM":
            case "ACTIONS_ON_GOOGLE":
            default:
              agent.add("Vaya, tenemos todo el día lleno");
              agent.add(text);
              break;
          }
        }
      }
    } else {
      switch (agent.requestSource) {
        case "TELEGRAM":
        case "ACTIONS_ON_GOOGLE":
        default:
          agent.add(answer.data);
          break;
      }
    }
  }

  function dateOptions() {
    const [number, options] = [
      agent.parameters.number,
      agent.context.get("dateoptions").parameters.options,
    ];
    const reservation = agent.context.get("reservation").parameters;
    const customerName = reservation.customerName.name;
    const numPeople = reservation.numPeople;
    const totalOptions = options.length;
    let text;
    if (!number) {
      text =
        "Por favor, elija una de las opciones disponibles, si no lo recuerda diga 'repetir'";
    } else if (number < 1 || number > totalOptions) {
      text =
        "Es necesario que elija una opción acorde al listado, si recuerda el listado diga 'opciones'";
    } else {
      utilities.deleteContexts(agent, "dateoptions", "schedule");
      const date = options[number - 1].date;
      const prefOutside = options[number - 1].prefOutside;
      let parameters = {
        date: date,
        prefOutside: prefOutside,
      };
      utilities.setContext(agent, "confirmreservation", 50, parameters);
      let fullDate = new Date(date).toISOString();
      let year = fullDate.substring(0, 4);
      let month = fullDate.substring(5, 7);
      let day = fullDate.substring(8, 10);
      let hour = fullDate.substring(11, 13);
      let minutes = fullDate.substring(14, 16);
      let dateText = `${day}/${month}/${year} a las ${hour}:${minutes}`;
      prefOutsideText =
        prefOutside == false ? `el interior del local` : `la terraza`;
      let textPeople = numPeople > 1 ? `${numPeople} personas` : `una persona`;
      text = `Perfecto ${utilities.capitalizeFirstLetter(
        customerName
      )}, ¿confirmas la reserva para el día ${dateText} en ${prefOutsideText} para ${textPeople}? si responde que "no" borraremos la reserva pero si cree que hay algún dato erroneo, puede decirnos el cambio y volveremos a consultarlo.`;
    }
    agent.add(text);
  }

  async function schedule() {
    establishmentID = agent.context.get("schedule").parameters.establishmentID;
    let answer = await utilities.getWeeklySchedule(establishmentID);
    let string = "";
    answer.data.forEach((e) => (string += e + "\n"));
    switch (agent.requestSource) {
      case "ACTIONS_ON_GOOGLE":
        conv.ask(string);
        conv.ask(
          new Suggestions(["Deseo reservar", "Realizar otras consultas"])
        );
        agent.add(conv);
        break;
      case "TELEGRAM":
      default:
        if (!agent.context.session.includes("whatsapp")) {
          agent.add(answer.data);
        } else {
          agent.add(string);
        }
        break;
    }
  }

  async function terrace() {
    let establishmentID = agent.context.get("terrace").parameters
      .establishmentID;
    let answer = await utilities.checkTerrace(establishmentID);
    let terrace = answer.data
      ? "dispone de terraza ✔️"
      : "no dispone de terraza ❌, pero puede disfrutar de nuestra zona interior climatizada.";
    let terraceVoiceGoogle = answer.data
      ? "dispone de terraza"
      : "no dispone de terraza , pero puede disfrutar de nuestra zona interior climatizada.";
    switch (agent.requestSource) {
      case "ACTIONS_ON_GOOGLE":
        conv.ask(
          new SimpleResponse({
            speech: `Nuestro local ${terraceVoiceGoogle}`,
            text: `Nuestro local ${terrace} 😀.`,
          })
        );
        agent.add(conv);
        break;
      case "TELEGRAM":
      default:
        agent.add(`Nuestro local ${terrace} 😀.`);
    }
  }

  function convertNumberToEmoji(num) {
    let emoji;
    if (num > 9) {
      let newRes = "";
      num = num.toString();
      newRes += convertNumberToEmoji(parseInt(num.substring(0, 1)));
      newRes += convertNumberToEmoji(parseInt(num.substring(1, 2)));
      return newRes;
    }
    switch (num) {
      case 0:
        emoji = "0️⃣";
        break;
      case 1:
        emoji = "1️⃣";
        break;
      case 2:
        emoji = "2️⃣";
        break;
      case 3:
        emoji = "3️⃣";
        break;
      case 4:
        emoji = "3️⃣";
        break;
      case 5:
        emoji = "5️⃣";
        break;
      case 6:
        emoji = "6️⃣";
        break;
      case 7:
        emoji = "7️⃣";
        break;
      case 8:
        emoji = "8️⃣";
        break;
      case 9:
        emoji = "9️⃣";
        break;
    }
    return emoji;
  }

  async function aboutMenu() {
    let ingredients = agent.parameters.ingredients;
    let allergens = agent.parameters.allergens;
    let todaysMenu = agent.parameters.todaysMenu;
    let establishmentID = agent.context.get("menu").parameters.establishmentID;
    let answer = await utilities.getEstablishmentByID(establishmentID);
    var menus = Object.values(answer.data.menus);
    let texto;
    if (!ingredients[0] && !allergens[0] && !todaysMenu) {
      texto = "Estos son nuestros menús";
      // MENU COMPLETO
      aboutMenuPrint(menus, texto);
    } else if (allergens[0] && ingredients[0]) {
      // MENU CON AMBOS FILTROS
      menus = utilities.filterMenusByAllergen(menus, allergens);
      menus = utilities.filterMenusByIngredient(menus, ingredients);
      menus.length > 0
        ? (texto = `Estos son los menus que tenemos sin ${allergens[0]} y con ${ingredients[0]}`)
        : (texto = `Lo sentimos no tenemos menus sin ${allergens[0]} y con ${ingredients[0]}`);
      aboutMenuPrint(menus, texto);
    } else if (allergens[0] || ingredients[0]) {
      if (!ingredients[0]) {
        // MENU CON FILTRO ALERGENOS
        menus = utilities.filterMenusByAllergen(menus, allergens);
        menus.length > 0
          ? (texto = `Estos son los menus que tenemos sin ${allergens[0]}`)
          : (texto = `Lo sentimos no tenemos menus sin ${allergens[0]}`);
        aboutMenuPrint(menus, texto);
      } else {
        // MENU CON FILTRO INGREDIENTES
        menus = utilities.filterMenusByIngredient(menus, ingredients);
        menus.length > 0
          ? (texto = `Estos son los menus que tenemos con ${ingredients[0]}`)
          : (texto = `Lo sentimos no tenemos menus con ${ingredients[0]}`);
        aboutMenuPrint(menus, texto);
      }
    } else {
      // MENU DEL DIA
      let answer = utilities.getTodaysMenu(menus);
      let menu = answer.data;
      let ingredientes = "";
      menu.ingredients.forEach((e) => (ingredientes += e.name + "  \n"));
      switch (agent.requestSource) {
        case "TELEGRAM":
          agent.add(
            `Este es el menu del dia, ¿Deseas reservar o realizar otras consultas?`
          );
          agent.add(
            new Card({
              title: menu.name,
              imageUrl: menu.urlImg,
              text: `${ingredientes}`,
            })
          );
          break;
        case "ACTIONS_ON_GOOGLE":
          conv.ask(
            "Este es el menú del dia, ¿Deseas reservar o realizar otras consultas?"
          );
          conv.ask(
            new BasicCard({
              text: `${ingredientes}`,
              subtitle: `Ingredientes`,
              title: menu.name,
              image: new Image({
                url: menu.urlImg,
                alt: menu.name,
              }),
            })
          );
          conv.ask(
            new Suggestions(["Deseo reservar", "Realizar otras consultas"])
          );
          agent.add(conv);
          break;
        default:
          agent.add(
            `El menu del dia es ${menu.name}, ¿Deseas reservar o realizar otras consultas?`
          );
          break;
      }
    }
  }

  function aboutMenuPrint(menus, texto) {
    switch (agent.requestSource) {
      case "ACTIONS_ON_GOOGLE":
        items = {};
        conv.ask(texto);
        if (menus.length >= 2) {
          menus.every((e) => {
            if (e.availability) {
              items[e.id] = {
                title: e.name,
                description: `Precio: ${e.price}€`,
                image: new Image({
                  url: e.urlImg,
                  alt: e.name,
                }),
              };
            }
            return e.availability && Object.keys(items).length < 10;
          });
          conv.ask(
            new Carousel({
              title: "Menus",
              items: items,
            })
          );
        }
        agent.add(conv);
        break;
      case "TELEGRAM":
      default:
        let respuesta;
        if (!agent.context.session.includes("whatsapp")) {
          respuesta = [texto];
          menus.forEach((e, i) => {
            respuesta.push("\n" + convertNumberToEmoji(i + 1) + " - " + e.name);
          });
          agent.add(respuesta);
        } else {
          respuesta = texto;
          menus.forEach((e, i) => {
            respuesta += "\n" + convertNumberToEmoji(i + 1) + " - " + e.name;
          });
          agent.add(respuesta);
        }
        break;
    }
  }

  async function confirmCancelReservationYes() {
    const reservation = agent.context.get("confirmcancelreservation")
      .parameters;
    const establishmentID = agent.context.get("cancelreservation").parameters
      .establishmentID;
    const answer = await utilities.deleteReservation(
      establishmentID,
      reservation
    );
    utilities.deleteContexts(
      agent,
      "cancelreservation",
      "confirmcancelreservation"
    );
    utilities.setContext(agent, "exit", 50, {
      establishmentID: establishmentID,
    });
    const text = answer.data;
    if (answer.status) {
      switch (agent.requestSource) {
        case "TELEGRAM":
        case "ACTIONS_ON_GOOGLE":
        default:
          agent.add(text);
          break;
      }
    } else {
      switch (agent.requestSource) {
        case "TELEGRAM":
        case "ACTIONS_ON_GOOGLE":
        default:
          agent.add(text);
          break;
      }
    }
  }

  function confirmCancelReservationNo() {
    const reservation = agent.context.get("confirmcancelreservation")
      .parameters;
    utilities.deleteContexts(
      agent,
      "cancelreservation",
      "confirmcancelreservation"
    );
    utilities.setContext(agent, "exit", 50, {
      establishmentID: establishmentID,
    });
    const text = `No se preocupe ${reservation.customerName}, su reserva para el día ${reservation.day}/${reservation.month}/${reservation.year} a las ${reservation.hour}:00 sigue activa.\n¿Puedo ayudarle en algo más?`;
    switch (agent.requestSource) {
      case "TELEGRAM":
      case "ACTIONS_ON_GOOGLE":
      default:
        agent.add(text);
        break;
    }
  }

  async function cancelReservation() {
    utilities.deleteContexts(
      agent,
      "reservation",
      "schedule",
      "menu",
      "otherqueries",
      "terrace"
    );
    const establishmentID = agent.context.get("cancelreservation").parameters
      .establishmentID;
    const reservationID = agent.parameters.reservationID;
    const answer = await utilities.verifyReservationID(
      establishmentID,
      reservationID
    );
    if (answer.status) {
      const text = answer.data.text;
      const reservation = answer.data.reservation;
      utilities.setContext(agent, "confirmcancelreservation", 50, reservation);
      switch (agent.requestSource) {
        case "TELEGRAM":
        case "ACTIONS_ON_GOOGLE":
        default:
          agent.add(text);
          break;
      }
    } else {
      const text = answer.data;
      switch (agent.requestSource) {
        case "TELEGRAM":
        case "ACTIONS_ON_GOOGLE":
        default:
          agent.add(text);
          break;
      }
    }
  }

  function listReservationOptions() {
    agent.setFollowupEvent("backtoreservation");
    agent.add("");
  }

  function helpMoreYes() {
    utilities.setContext(agent, "verified", 50, {
      establishmentID: agent.context.get("exit").parameters.establishmentID,
    });
    utilities.deleteContexts(agent, "exit");
    agent.setFollowupEvent("establishmentData");
    agent.add("ok");
  }

  function fallbackReservation() {
    agent.setFollowupEvent("backtoreservation");
    agent.add("");
  }

  function exitReservation() {
    utilities.setContext(agent, "exit", 50, {
      establishmentID: agent.context.get("reservation").parameters
        .establishmentID,
    });
    utilities.deleteContexts(
      agent,
      "reservation",
      "schedule",
      "dateoptions",
      "confirmreservation"
    );
    const text =
      "Vale, hemos salido de la reserva, ¿Puedo ayudarle en algo más?";
    switch (agent.requestSource) {
      case "TELEGRAM":
      case "ACTIONS_ON_GOOGLE":
      default:
        agent.add(text);
        break;
    }
  }

  function exit() {
    Object.values(agent.context.contexts).forEach((contextName) =>
      agent.context.delete(contextName.name)
    );
    agent.add("");
  }

  function helpMoreNo() {
    agent.setFollowupEvent("exit");
    agent.add("");
  }
  const intentMap = new Map();
  intentMap.set("Exit", exit);
  intentMap.set("ExitReservation", exitReservation);
  intentMap.set("FallbackReservation", fallbackReservation);
  intentMap.set("HelpMoreNo", helpMoreNo);
  intentMap.set("HelpMoreYes", helpMoreYes);
  intentMap.set("ConfirmCancelReservationYes", confirmCancelReservationYes);
  intentMap.set("ConfirmCancelReservationNo", confirmCancelReservationNo);
  intentMap.set("CancelReservation", cancelReservation);
  intentMap.set("ListReservationOptions", listReservationOptions);
  intentMap.set("DateOptions", dateOptions);
  intentMap.set("ConfirmReservationYes", confirmReservationYes);
  intentMap.set("ConfirmReservationNo", confirmReservationNo);
  intentMap.set("Establishments", establishments);
  intentMap.set("EstablishmentQuery", establishmentQuery);
  intentMap.set("Reservation", reservation);
  intentMap.set("VerifyAccess", verifyAccess);
  intentMap.set("Schedule", schedule);
  intentMap.set("Terrace", terrace);
  intentMap.set("Carousel - OPTION", carouselOPTION);
  intentMap.set("WelcomeGoogleAssistant", welcomeGoogleAssistant);
  intentMap.set(
    "InformationAboutUserGoogleAssistant",
    informationAboutUserGoogleAssistant
  );
  intentMap.set("AboutMenu", aboutMenu);
  intentMap.set("MenuData", menuData);
  agent.handleRequest(intentMap);
});

module.exports = app;
