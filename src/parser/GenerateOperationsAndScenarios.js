function getDefinedChannel (key,value,publishChannels,subscribeChannels) {
  if (!!publishChannels.soloOps[value._json['x-plot']] ||
      !!subscribeChannels.soloOps[value._json['x-plot']]) {
    console.log(`\nError solo scenario key: ${key} was specified more than one times.\nNon-group scenario keys (x-scenario) should be
      different in each channel`);
  }
  if (!!value.publish()) {
    if (value._json['x-plot']) {
      publishChannels.soloOps[value._json['x-plot']] = Object.assign({}, value.publish()._json, {route: key});
    }
    if (value._json['x-group']) {
      if (!publishChannels.groupOps[value._json['x-group']]) {
        publishChannels.groupOps[value._json['x-group']] = {};
      }
      Object.assign(publishChannels.groupOps[value._json['x-group']], {[key]: value.publish()._json});
    }
  } else if (!!value.subscribe() && value._json['x-plot']) {
    subscribeChannels.soloOps[value._json['x-plot']] = Object.assign({}, value.subscribe()._json, {route: key});
  } else if (!!value.subscribe() && value._json['x-group'] && !subscribeChannels.groupOps[value._json['x-group']]) {
    subscribeChannels.groupOps[value._json['x-group']] = {};

    Object.assign(subscribeChannels.groupOps[value._json['x-group']], {[key]: value.subscribe()._json});
  }
}

function getDefinedChannels (channels) {
  const publishChannels = {
    soloOps: {},
    groupOps: {}
  };
  const subscribeChannels = {
    soloOps: {},
    groupOps: {}
  };

  for (const [key, value] of Object.entries(channels)) {
    getDefinedChannel(key,value,publishChannels,subscribeChannels);
  }
  return [publishChannels,subscribeChannels];
}

function generateOperations (scenarioParsed) {
  const operations = {};

  for (const [name,value] of Object.entries(scenarioParsed)) {
    if (!name.match(RegExp(/^scenario-[\w\d]+$/))) {
      Object.assign(operations,{[name]: value});
    }
  }

  return operations;
}

function generateScenarios(scenarioParsed,operations) {
  const scenarios = {};
  for (const [itemName,value] of Object.entries(scenarioParsed)) {
    if (itemName.match(RegExp(/^scenario-[\w\d]+$/))) {
      scenarios[String(itemName)]  = {};
      for (const operationName of value) {
        for (const [name,value] of Object.entries(operations)) {
          if (name === operationName) {
            Object.assign(scenarios[String(itemName)], {[name]: value});
          }
        }
      }
    }
  }
  return scenarios;
}

/**
 * Take a parsed asyncApi and scenario file and generates two objects that describe
 * publish and subscribe operations with the needed details for the request handler
 * be able to make requests.
 * @param asyncApiParsed
 * @param scenarioParsed
 * @returns {{}[]}
 */
const generateOperationsAndScenarios = (asyncApiParsed, scenarioParsed) => {
  const channels = {
    publish: {},
    subscribe: {}
  };

  [channels.publish,channels.subscribe] = getDefinedChannels(asyncApiParsed.channels());

  const operations = generateOperations(scenarioParsed);

  const scenarios = generateScenarios(scenarioParsed,operations);

  return [operations,scenarios];
};

module.exports = {generateOperationsAndScenarios};
