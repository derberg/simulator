const mqtt = require('async-mqtt');
const randExp = require('randexp');
function randomChannelParamNumber (min,max) {
  return Math.floor(Math.random() * max); //NOSONAR
}

function getChannelParams (channelName) {
  return  new Promise((res,rej) => {
    const securityTimeout = setTimeout(() => {
      console.log('\nDDOS warning.');
      rej(new Error('\'Regex generation timed out\''));
    },1000);
    const params = channelName.match(new RegExp(/{(.*?)}/gm)).map((item) => item.substring(1, item.length - 1)); //NOSONAR
    clearInterval(securityTimeout);
    res(params);
  });
}

function randomString (regex) {
  return new Promise((res,rej) => {
    const securityTimer = setTimeout(() => {
      console.log('\nDDOS warning.');
      rej(new Error('Regex generation timed out'));
    }
    ,1000);

    const generatedStr = new randExp(regex).gen();

    clearInterval(securityTimer);
    res(generatedStr);
  });
}

async function replaceChannelParams (channelParams,urlParameters,channelName) {
  for (const [name, value] of Object.entries(channelParams)) {
    channelName = await replaceChannelParam(urlParameters,name,value,channelName);
  }
  return channelName;
}

async function replaceChannelParam (urlParameters,name,value,channelName) {
  if (urlParameters.some((item) => item === name)) {
    const generatedString = (!!value.regex) ? await randomString(value.regex) : null;
    const generatedNumber = (typeof value.min === 'number') && (typeof value.max === 'number') ? randomChannelParamNumber(value.min, value.max) : null;
    let parameterValue;
    if (generatedString  || typeof generatedNumber === 'number')
      if (typeof generatedNumber === 'number')  parameterValue = generatedNumber;
      else parameterValue = generatedString;
    else
      parameterValue = value;
    return channelName.replace(`{${name}}` , parameterValue);
  }
}

async function runOperationForChannel (channelName,details,client,cycles,interval,aliveOperations,operatioName) {
  let currentCycle = 0;

  const channelParams = Object.assign(details);
  const payload = (!!channelParams.payload) ? channelParams.payload : {};

  if (!!payload)  delete channelParams.payload;
  else console.log(`\nNotice: Channel ${channelName} has no payload.`);

  const urlParameters = await getChannelParams(channelName);

  const actionLoop = setInterval(async () => {
    currentCycle += 1;
    const channel = await replaceChannelParams(channelParams,urlParameters,channelName);
    console.log(channel);
    await client.publish(channel, JSON.stringify(payload));
    if (currentCycle === cycles)
      clearInterval(actionLoop);
  }, interval);

  aliveOperations[String(operatioName)] = {
    loopInstance: actionLoop
  };
}

// eslint-disable-next-line sonarjs/cognitive-complexity
async function  mqttHandler (serverInfo,scenarios,parameterDefinitions,operations) {
  delete operations.version;
  const aliveOperations = {};
  const aliveScenarios = {};
  let serverUrl;
  if (!!serverInfo.variables?.port) {
    serverUrl = serverInfo.url.replace('{port}' , serverInfo.variables.port.default);
  } else {
    serverUrl = serverInfo.url;
  }
  const client = await mqtt.connectAsync(`mqtt:${serverUrl}`);

  async function runOperation (operatioName,operationData) {
    aliveOperations[String(operatioName)] = {};

    if (operationData.loop) {
      const channels = Object.assign({},operationData.loop);

      const cycles = operationData.loop.cycles;
      const interval = operationData.loop.interval;

      delete channels.interval;
      delete channels.cycles;

      for (const [channelName, details] of Object.entries(channels)) {
        await runOperationForChannel(channelName,details,client,cycles,interval,aliveOperations,operatioName);
      }
    } else {
      // eslint-disable-next-line prefer-const
      for (let [channelName, channelValue] of Object.entries(operationData)) {
        aliveOperations[String(operatioName)] = {};

        const channelParams = Object.assign({}, channelValue);
        const payload = (!channelValue.payload) ? {} : channelValue.payload;

        if (!!channelParams.payload)  delete channelParams.payload;
        else console.log(`\nChannel ${channelName} has no payload.`);

        const urlParameters = await getChannelParams(channelName);

        // eslint-disable-next-line prefer-const
        for (let [name, value] of Object.entries(channelParams)) {
          if (urlParameters.some((item) => item === name)) {
            const generatedString = (!!value.regex) ? randomString(value.regex) : 'NotSpecifiedString';
            const generatedNumber = (!!(value.min) && !!(value.max)) ? randomChannelParamNumber(value.min, value.max) : 'NotSpecifiedNumber';
            value = (generatedString) ? generatedString : generatedNumber;
            channelName = channelName.replace(`{${name}}`, value);
          }
        }
        setTimeout(async () => {
          console.log(channelName);
          await client.publish(channelName, JSON.stringify(payload));
        }, 100);
      }
    }
  }

  async function startOperations (operationName) {
    if (operationName === 'all') {
      for (const [operatioName,operationData] of Object.entries(operations)) {
        runOperation(operatioName,operationData);
      }
    } else {
      runOperation(operationName,operations[String(operationName)]);
    }
  }
  async function startScenario (scenarioName = 'all') {
    if (scenarioName === 'all') {
      for (const scenarioOperations of Object.values(scenarios)) {
        for (const operationName of Object.keys(scenarioOperations)) {
          await startOperations(operationName);
        }
      }
    } else {
      for (const operationName of Object.keys(scenarios[`scenario-${scenarioName}`])) {
        await startOperations(operationName);
      }
    }
  }

  return {
    aliveScenarios,
    aliveOperations,
    startScenario,
    startOperations
  };
}

module.exports = {mqttHandler};
