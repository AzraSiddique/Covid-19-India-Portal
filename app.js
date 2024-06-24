const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

let db = null;

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log(`The server is running on http://localhost/3000`);
    });
  } catch (e) {
    console.log(`DB Error is ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const convertToResponse = (object) => {
  return {
    stateId: object.state_id,
    stateName: object.state_name,
    population: object.population,
    districtId: object.district_id,
    districtName: object.district_name,
    cases: object.cases,
    cured: object.cured,
    active: object.active,
    deaths: object.deaths,
  };
};

const authenticationFunc = (request, response, next) => {
  let jwtToken;
  let authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401).send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "mySecretKey", async (error, payload) => {
      if (error) {
        response.status(401).send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API 1//
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  try {
    const getUserQuery = `
    SELECT *
    FROM user
    WHERE username='${username}'
    `;
    const dbUser = await db.get(getUserQuery);
    if (dbUser === undefined) {
      response.status(400).send("Invalid user");
    } else {
      const passwordMatch = await bcrypt.compare(password, dbUser.password);
      if (passwordMatch === true) {
        const payload = {
          username: username,
        };
        const jwtToken = jwt.sign(payload, "mySecretKey");
        response.send({ jwtToken });
      } else {
        response.status(400).send("Invalid password");
      }
    }
  } catch (e) {
    console.log(`error: ${e}`);
  }
});

//API 2//
app.get("/states/", authenticationFunc, async (request, response) => {
  try {
    const getStateQuery = `
    SELECT *
    FROM state
    ORDER BY state_id`;

    const dbResponse = await db.all(getStateQuery);
    response.send(dbResponse.map((item) => convertToResponse(item)));
  } catch (e) {
    console.log(`error: ${e}`);
  }
});

//API 3//
app.get("/states/:stateId/", authenticationFunc, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
    SELECT *
    FROM state
    WHERE state_id=${stateId};`;
  const dbResponse = await db.get(getStateQuery);
  response.send(convertToResponse(dbResponse));
});

//API 4//
app.post("/districts/", authenticationFunc, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;

  const createDistrictQuery = `
  INSERT INTO district(district_name,state_id,cases,cured,active,deaths)
  VALUES('${districtName}',${stateId},${cases},${cured},${active},${deaths})`;

  const dbResponse = await db.run(createDistrictQuery);
  const districtId = dbResponse.lastId;
  response.send("District Successfully Added");
});

//API 5//
app.get(
  "/districts/:districtId/",
  authenticationFunc,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
  SELECT *
  FROM district
  WHERE district_id=${districtId};`;
    const dbResponse = await db.get(getDistrictQuery);
    response.send(convertToResponse(dbResponse));
  }
);

//API 6//
app.delete(
  "/districts/:districtId/",
  authenticationFunc,
  async (request, response) => {
    const { districtId } = request.params;
    const removeDistrictQuery = `
  DELETE FROM district
  WHERE district_id=${districtId};
  `;
    const dbResponse = await db.run(removeDistrictQuery);
    response.send("District Removed");
  }
);

//API 7//
app.put(
  "/districts/:districtId/",
  authenticationFunc,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;

    const updateDistrictQuery = `
    UPDATE district
    SET 
    district_name='${districtName}',
    state_id=${stateId},
    cases=${cases},
    cured=${cured},
    active=${active},
    deaths=${deaths}
    WHERE district_id=${districtId};
    `;
    const dbResponse = await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//API 8//
app.get(
  "/states/:stateId/stats/",
  authenticationFunc,
  async (request, response) => {
    const { stateId } = request.params;
    const getSumQuery = `
    SELECT SUM(cases) AS totalCases,
    SUM(cured) AS totalCured,
    SUM(active) AS totalActive,
    SUM(deaths) AS totalDeaths
    FROM district
    WHERE state_id=${stateId};`;

    const dbResponse = await db.get(getSumQuery);
    response.send(dbResponse);
  }
);

module.exports = app;
