const express = require('express');
require('dotenv').config();
const StaticMaps = require('staticmaps');
const AWS = require('aws-sdk');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const app = express();
const s3 = new AWS.S3({
	region:'eu-central-1',
	signatureVersion: 'v4',
	accessKeyId: process.env.ACCESS_KEY_ID,
	secretAccessKey: process.env.SECRET_ACCESS_KEY,
});


// SendUrl function
const sendUrl = (mapImage) => {
	const url = `https://${process.env.BUCKET}.s3.eu-central-1.amazonaws.com/${mapImage}`;

	return url;
};

const getDimensions = (size) => {
	switch (size) {
		case 'small':
			return {
				width: 600,
				height: 400,
			};
		case 'medium':
			return {
				width: 800,
				height: 600,
			};
		case 'large':
			return {
				width: 1000,
				height: 800,
			};
		default:
			return {
				width: 800,
				height: 600,
			};
	}
};

app.get('/generate', (req, res) => {
	const { query } = req;

	const { lat, lng, size = 'medium', zoom = 13 } = query;

	const mapImage = `map-${lat}-${lng}-${size}.png`;

	const mapDimensions = getDimensions(query.size);

	const mapOptions = {
		width: mapDimensions.width,
		height: mapDimensions.height,
		tileUrl: 'https://mt.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
	};

	const mapMarker = {
		img: `${__dirname}/assets/pin.png`,
		offsetX: 18,
		offsetY: 54,
		width: 36,
		height: 54,
		coord: [parseFloat(query.lng),parseFloat(query.lat)],
		};

	const map = new StaticMaps(mapOptions);
	const center = [parseFloat(query.lng),parseFloat(query.lat)];

	map.addMarker(mapMarker);

	map.render(center, zoom)
	.then(() => map.image.save(`./generated/${mapImage}`))
	.then(async () => {
		const uploadParams = { Bucket: process.env.BUCKET, Key: '', Body: '' };

		const fileStream = fs.createReadStream(`./generated/${mapImage}`);
		fileStream.on('error', function(err) {
			console.log('File Error', err);
		});

		uploadParams.Body = fileStream;
		uploadParams.Key = path.basename(mapImage);

		s3.upload(uploadParams, function (err, data) {
			if (err) {
				res.json({
					status: 'error',
					err: err,
				});
			}

			if (data) {
				res.json({
					status: 'success',
					url: data.Location,
				});
			}
		});
	})
	.catch((err) => res.json({
		status: 'Something went wrong',
		err,
	}));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));