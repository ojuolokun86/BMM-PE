const chalk = require("chalk").default;

const originalLog = console.log;

console.log = (...args) => {
  const time = new Date().toLocaleTimeString();

  originalLog(
    chalk.cyan(`[${time}]`),
    chalk.green("LOG →"),
    ...args
  );
};

console.error = (...args) => {
  const time = new Date().toLocaleTimeString();

  originalLog(
    chalk.cyan(`[${time}]`),
    chalk.red("ERROR →"),
    ...args
  );
};

console.warn = (...args) => {
  const time = new Date().toLocaleTimeString();

  originalLog(
    chalk.cyan(`[${time}]`),
    chalk.yellow("WARN →"),
    ...args
  );
};