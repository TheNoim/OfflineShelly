import { readFile } from "node:fs/promises";
import mqtt from "mqtt";
import dotenv from "dotenv";
import inquirer from "inquirer";
import fetch from "node-fetch";

const zigbeeDevices = [];

const tasmotaDevices = [];

dotenv.config();

const connection = mqtt.connect({
	host: process.env.MQTT_HOST,
	port: (process.env.PORT ? parseInt(process.env.PORT) : undefined) ?? 1883,
	username: process.env.MQTT_USER,
	password: process.env.MQTT_PASSWORD,
});

console.log("Connecting to mqtt...");

await new Promise((resolve) => {
	connection.on("connect", resolve);
});

console.log("Connected");

const granted = await new Promise((resolve, reject) => {
	connection.subscribe(["#", "$SYS/#"], (err, granted) => {
		if (err) return reject(err);
		resolve(granted);
	});
});

connection.on("message", (topic, payload) => {
	if (topic.startsWith("zigbee2mqtt") && topic.endsWith("availability")) {
		const device = topic.replace(/\/availability/gim, "");
		if (zigbeeDevices.includes(device)) return;
		zigbeeDevices.push({
			name: device,
		});
	} else if (topic.startsWith("tasmota/discovery")) {
		const config = JSON.parse(payload);
		if (!config || !config.dn || !config.t) return;
		tasmotaDevices.push({
			name: config.dn,
			value: config.ip,
		});
	}
});

console.log("Wait to discover devices...");

await new Promise((resolve) => setTimeout(resolve, 1000));

console.log("Stop waiting");

const result = await inquirer.prompt([
	{
		type: "list",
		choices: zigbeeDevices,
		message: "Which light?",
		name: "light",
	},
	{
		type: "list",
		choices: tasmotaDevices,
		message: "Which tasmota device?",
		name: "tasmota",
	},
	{
		type: "confirm",
		message: "Has this tasmota device a password?",
		name: "hasPassword",
	},
	{
		type: "input",
		message: "Username",
		name: "username",
		when: (hash) => hash.hasPassword,
	},

	{
		type: "password",
		message: "Password",
		name: "password",
		when: (hash) => hash.hasPassword,
	},
]);

const templateBuffer = await readFile("./shelly.rules");

const template = templateBuffer.toString();

const lines = template
	.split("\n")
	// Filter all comments
	.filter((line) => !line.startsWith("--"))
	.filter((line) => !!line.trim());

const commands = [];

for (const line of lines) {
	// Belongs to a command
	if (line.startsWith("   ") || line.startsWith(" ")) {
		const lastCommand = commands.at(commands.length - 1);
		commands.pop();
		commands.push(lastCommand + "\n" + line);
	} else {
		// New command
		commands.push(line);
	}
}

const postCommands = [];
const preCommands = [];

for (const command of commands) {
	const subCommands = command.match(/Subscribe\s*?.+?,\s*?.+?(\s|,.+?\s)/gim);
	if (subCommands) {
		for (const subCommand of subCommands) {
			postCommands.push([
				subCommand
					.match(/^\S+(\n|\s+)/gm)
					.at(0)
					?.replace(/(\n|\s)/, "")
					.trim(),
				subCommand
					.replace(/^\S+(\n|\s+)/gm, "")
					?.trim()
					.replace(/\$TOPIC\$/gm, result.light),
			]);
		}
	}

	const cmd = command
		.match(/^\S+(\n|\s+)/gm)
		.at(0)
		?.replace(/(\n|\s)/, "");
	if (!cmd) continue;
	const params = command.replace(/^\S+(\n|\s+)/gm, "").replace(/\$TOPIC\$/gm, result.light);

	preCommands.push([cmd.trim(), params.trim()]);
}

console.log("Run this commands:");

for (const [index, [cmd, params]] of preCommands.entries()) {
	console.log(`${index + 1}.: ${cmd} ${params}`);
}

console.log("Apply this subscriptions:");

for (const [index, [cmd, params]] of postCommands.entries()) {
	console.log(`${index + 1}.: ${cmd} ${params}`);
}

const confirmResult = await inquirer.prompt({
	type: "confirm",
	message: "Execute commands via mqtt?",
	name: "execute",
});

if (!confirmResult.execute) process.exit(1);

connection.end();

for (const [cmd, params] of [...preCommands, ...postCommands]) {
	console.log("Execute " + cmd);
	await fetch(
		`http://${result.tasmota}/cm?${new URLSearchParams({
			cmnd: `${cmd} ${params}`,
			...(result.hasPassword
				? {
						user: result.username,
						password: result.password,
				  }
				: {}),
		}).toString()}`
	);
}
