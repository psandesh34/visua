import express from 'express';
import routes from './routes';
import mongoose from 'mongoose';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(
	cors({
		origin: ['http://localhost:3000', 'http://localhost:4200'],
	})
);

async function main() {
	try {
		await mongoose.connect('mongodb://127.0.0.1:27017/visualizer', {
			// useNewUrlParser: true,
		});
	} catch (error) {
		console.error(
			`Error occured while creating a db connection: ${error.message}`
		);
		process.exit(0);
	}

	const port = 3000;
	app.listen(port, () => {
		return console.log(`server is listening on ${port}`);
	});
	routes(app);
}

main();
