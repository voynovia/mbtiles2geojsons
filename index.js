'use strict';

module.exports = extract;

const Database = require('better-sqlite3')
const VectorTile = require('@mapbox/vector-tile').VectorTile
const Protobuf = require('pbf')
const zlib = require('zlib')
const fs = require('fs');

function extract(mbTilesPath, geojsonFolder) {
    console.log('Extracting ' + mbTilesPath + ' to ' + geojsonFolder + ' folder');

    function getPath(layerName) {
        return geojsonFolder + '/' + layerName + '.geojson';
    }

    function saveGeoJson(layerName, data) {
        fs.appendFileSync(getPath(layerName), data, function (err) {
            if (err) return console.log(err);
        });
    }

    fs.rmSync(geojsonFolder, { recursive: true, force: true })
    fs.mkdirSync(geojsonFolder)
    var array = [];
    const db = new Database(mbTilesPath)
    for (const r of db.prepare('SELECT * FROM tiles').iterate()) {
        const z = r.zoom_level
        const x = r.tile_column
        const y = (1 << z) - r.tile_row - 1
        const data = zlib.gunzipSync(r.tile_data)
        try {
            const tile = new VectorTile(new Protobuf(data))
            for (const l in tile.layers) {
                var tileJson = ''
                for (let i = 0; i < tile.layers[l].length; i++) {
                    const feature = tile.layers[l].feature(i)
                    tileJson += JSON.stringify(feature.toGeoJSON(x, y, z), null, 2)
                    if (i < tile.layers[l].length - 1) {
                        tileJson += ','
                    }
                }
                if (array.includes(l)) {
                    saveGeoJson(l, ','+tileJson)
                } else {
                    array.push(l);
                    saveGeoJson(l, '{"type": "FeatureCollection","features": ['+tileJson)
                }
            }
        } catch (err) {
            console.log(err)
        }
    }

    fs.readdir(geojsonFolder, function (err, files) {
        if (err) {
            return console.log('Unable to scan directory: ' + err);
        } 
        files.forEach(function (filename) {
            const path = geojsonFolder+'/'+filename
            fs.appendFileSync(path, ']}', function (err) {
            if (err) return console.log(err);
            });
        });
    });

}