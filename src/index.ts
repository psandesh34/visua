import express from "express";
import routes from "./routes";
import mongoose from "mongoose";
import bodyParser from "body-parser";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));


async function main() {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/visualizer", {
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
