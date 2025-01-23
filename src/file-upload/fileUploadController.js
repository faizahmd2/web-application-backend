
const utils = require("./utils");

var controllers = {
    uploadFile: async function(req, res) {
        const fileName = req.query.fileName
        const currentPart = req.query.currentPart

        try {
            const processed_file = utils.getUploadStatus(fileName);
            // console.log("processed_file::",processed_file);
            if(processed_file.totalParts > 1 && !processed_file.fileId) return res.json({status: 0, message: "Invalid Operation"});
            req.processed_file = processed_file;
            req.fileName = fileName;

            let write = await utils.convertFormidableAndWriteStream(req, currentPart)
            res.json({message: "File Successfully Uploaded", status: 1})
        } catch (error) {
            console.log("Error occured @ upload api",error.message)
            res.json({message: "Something bad happened!", status: 0})
        }
    },
    handleEvents: async function(req, res) {
        try {
            let { fileName, fileSize, totalParts } = req.query;
            let type = req.params.type

            if(!fileName || !type || (type == 'start' && !(fileSize || !totalParts))) return res.json({status: 0, message: "Parameters missing"})

            let {status, message} = await utils.handleUploadEvent(fileName, type, +fileSize, +totalParts)
            // console.log("STATUS -",status)
            // console.log("MESSAGE -",message)
            return res.json({status, message})
        } catch (error) {
            console.log("Error occured @ upload-event api",error)
            res.json({status: 0, message: "Something bad happened"})
        }
    }
}

module.exports = controllers;