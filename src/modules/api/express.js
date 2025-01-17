const express = require('express');
const axios = require('axios');

module.exports = class Express {

	constructor(client) {
		const {
			API_KEY,
			API_URL
		} = process.env;

		this.client = client;
		const app = express();
		const port = 3000;
		
		this.registerRoutes(app);
		
		app.listen(port, () => {
			client.log.info(`Express app listening at http://localhost:${port}`);
		});

		client.on('guildMemberRemove', member => {
			client.log.info('Member leave: ' + member.id);

			axios.patch(process.env.API_URL + '/unverify-user', { user_id: member.id }, 
				{ headers: { 'X-Authorization': process.env.API_KEY } });
		});
	}

	registerRoutes(app) {
		const router = express.Router();
		app.use('/', router);
		const jsonParser = express.json();
		const client = this.client;

		router.get("/has-user", async (req, res, next) => {
			client.log.info('User request received');

			const user = client.guilds.cache.get(client.config.guildID).members.fetch({ user: req.query.id, force: true, cache: false})
				.then(member => { res.status(200).json(true) })
				.catch(err => { 
					client.log.debug(err);
					res.status(500).json(false);
				});
			});

		router.post('/ticket', [jsonParser], async (req, res) => {
			client.log.info('Create request received');
			try {
				const body = req.body;
				const guild_id = body.guild_id;
				const user_id = body.user_id;
				const registrar_id = body.registrar_id;
				const сategory_id = body.category_id;
				const topic = body.topic;

				const registrar = await client.users.fetch(registrar_id);

				const ticket = await client.tickets.create(guild_id, user_id, сategory_id, topic, true);
				await ticket.update({ claimed_by: registrar_id });

				const channel = await client.channels.cache.get(ticket.id);
				await channel.permissionOverwrites.edit(registrar_id, { VIEW_CHANNEL: true }, `Ticket claimed by ${registrar.tag}`);

				const category = await client.db.models.Category.findOne({ where: { id: сategory_id } });

				for (const role of category.roles) {
					await channel.permissionOverwrites.edit(role, { VIEW_CHANNEL: false }, `Ticket claimed by ${registrar.tag}`);
				}

				res.status(200).send(ticket);
			} catch (error) {
				client.log.info(error);
				res.status(500).send('Ticket not found')
			}; 
		});

		app.delete('/ticket', [jsonParser], async (req, res) => {
			client.log.info('Delete request received');

			try {
				const body = req.body;
				const ticket_id = body.ticket_id;

				const ticket = await client.db.models.Ticket.findOne({ where: { id: ticket_id } });
				await client.tickets.close(ticket.id, ticket.creator, ticket.guild);

				client.log.info('Ticket closed!');
				res.status(200).send('Ticket deleted');
			} catch (error) {
				client.log.debug(error);
				res.status(500).send('Ticket not found');
			}; 
		});
	};
};
