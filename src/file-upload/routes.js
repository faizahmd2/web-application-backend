const uploadController = require("./fileUploadController");

module.exports = (app) => {
    app.post("/upload", uploadController.uploadFile);
    app.get("/upload-event/:type", uploadController.handleEvents);
}
