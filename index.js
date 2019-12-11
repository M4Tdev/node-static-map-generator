const express = require('express');
require('dotenv').config()
const StaticMaps = require('staticmaps');
const AWS = require('aws-sdk');

const app = express();
const s3 = new AWS.S3({
	region:'eu-central-1',
	signatureVersion: 'v4',
});

app.get('/', (req, res) => {
	res.json({
		message: 'Hi',
	});
})

// UploadNewMap function
const uploadNewMap = (mapImage, callback) => {
	const uploadParams = { Bucket: process.env.BUCKET, Key: '', Body: '' };

	const fs = require('fs');
	const fileStream = fs.createReadStream(mapImage);

	fileStream.on('error', function(err) {
		console.log('File Error', err);
	});

	uploadParams.Body = fileStream;

	const path = require('path');
	uploadParams.Key = path.basename(mapImage);

	s3.upload(uploadParams, function (err, data) {
		if (err) {
			console.log("Error", err);
			callback(err);
		}

		if (data) {
			console.log("Upload Success", data.Location);
			callback(data.Location);
		}
	});
};

// SendUrl function
const sendUrl = (params) => {
	const url = s3.getSignedUrl('getObject', params);
	return url;
};

app.get('/generate', (req, res) => {
	const { query } = req;

	const mapImage = `map-${query.name}-${query.lat}-${query.lng}-${query.width}-${query.height}.png`;

	const checkIfExistsParams = {
		Bucket: process.env.BUCKET,
		Key: mapImage,
	};

	s3.headObject(checkIfExistsParams, function (err, metadata) {
		if (err && err.code === 'NotFound') {
			const mapOptions = {
				width: parseInt(query.width),
				height: parseInt(query.height),
				// tileUrl: 'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
				tileUrl: 'https://mt.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
			};

			const map = new StaticMaps(mapOptions);
			const center = [parseFloat(query.lng),parseFloat(query.lat)];

			map.render(center, query.zoom = 13)
			.then(() => map.image.save(mapImage))
			.then(async () => {
				uploadNewMap(mapImage, function(url) {
					res.json({
						url,
					});
				});
			})
			.catch((err) => res.json({
				status: 'Something went wrong',
				err,
			}));
		} else {
			const url = sendUrl(checkIfExistsParams);

			res.json({
				url,
			});
		}
	});
});

app.listen(3000, () => console.log('Server started on port 3000'));