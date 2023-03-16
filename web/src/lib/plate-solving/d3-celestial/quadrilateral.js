import config from "./config";

const buildGeoJson = (points) => {
  const jsonQuadrilateralTemplate = {
    "type":"FeatureCollection",
    // this is an array, add as many objects as you want
    "features":[
      {"type":"Feature",
       "id":"Quadrilateral",
       "geometry":{
         // the line object as an array of point coordinates, 
         // always as [ra -180..180 degrees, dec -90..90 degrees]
         "type":"MultiLineString",
         "coordinates":[[
           [-80.7653, 38.7837],
           [-62.3042, 8.8683],
           [-49.642, 45.2803],
           [-80.7653, 38.7837]
         ]]
       }
      }
    ]
  };
  jsonQuadrilateralTemplate["features"][0]["geometry"]["coordinates"][0] = points;
  return jsonQuadrilateralTemplate;
}

const buildLineStyle = () => {
  return { 
    stroke: "rgba(204, 204, 0, 0.4)", 
    fill: "rgba(204, 204, 0, 0.1)",
    width: 2 
  };
}

export const addQuadrilateral = (Celestial, points) => {
  const geoJson = buildGeoJson(points);
  const lineStyle = buildLineStyle();
  const callback = (error, json) => {
    if (error) {
      return console.warn(error);
    }
    const quadrilateral = Celestial.getData(geoJson, config.transform);
    Celestial.container.selectAll(".quadrilateral")
      .remove();
    Celestial.container.selectAll(".asterisms")
      .data(quadrilateral.features)
      .enter()
      .append("path")
      .attr("class", "quadrilateral");
    Celestial.redraw();
  };
  const redraw = () => {
    Celestial.container.selectAll(".quadrilateral").each((data) => {
      Celestial.setStyle(lineStyle)
      Celestial.map(data);
      Celestial.context.fill();
      Celestial.context.stroke();
    });
  }
  Celestial.add({
    type: 'raw',
    callback,
    redraw
  });
};