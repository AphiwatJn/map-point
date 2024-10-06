import React, { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import axios from "axios";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";

export default function Map() {
  const [coordinateslocation, setCoordinateslocation] = useState({
    lngLat: { lng: 99.9216704, lat: 14.3515167 },
  });
  const [zoomLevel, setZoomLevel] = useState(6);
  const [inCounty, setInCounty] = useState([]);
  const [point, setPoint] = useState([]);
  const [active, setActive] = useState(null);
  const [ct, setCt] = useState("Thailand");
  const [loading, setLoading] = useState(true);

  // set Map data
  const mapContainer = useRef(null);
  const map = useRef(null);
  const lng = 99.9216704;
  const lat = 14.3515167;
  const API_KEY = "hLy7oyNS4rlUSXJNxYNr";

  // set Data and limit
  const numberMatched = 100000;
  const limit = 10000;

  // set Data form get Api
  const url =
    "https://v2k-dev.vallarismaps.com/core/api/features/1.1/collections";
  const api_key =
    "bLNytlxTHZINWGt1GIRQBUaIlqz9X45XykLD83UkzIoN6PFgqbH7M7EDbsdgKVwC";
  const collectionsId = "658cd4f88a4811f10a47cea7";

  ////////// set Map //////////////////////////////////
  useEffect(() => {
    if (map.current) return;
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${API_KEY}`,
      center: [lng, lat],
      zoom: zoomLevel,
    });

    map.current.addControl(new maplibregl.FullscreenControl());

    map.current.on("mousemove", (e) => {
      setCoordinateslocation({ lngLat: e.lngLat.wrap() });
    });

    map.current.on("zoom", () => {
      setZoomLevel(map.current.getZoom());
    });

    map.current.on("load", async () => {
      try {
        // const localGeoJsonData = JSON.parse(localStorage.getItem("geoJsonData"));
        let geoJsonData = "";
        // if (localGeoJsonData) {
        //   console.log('Local');
        //   geoJsonData = localGeoJsonData;
        // } else {
        console.log("get new");
        geoJsonData = await fetchDataAll();
        //   localStorage.setItem("geoJsonData", JSON.stringify(geoJsonData));
        // // }
        GetCounty(geoJsonData);
        setPoint(geoJsonData);
        setLoading(false);

        map.current.addSource("data", {
          type: "geojson",
          data: geoJsonData,
          cluster: true,
          clusterMaxZoom: 13,
          clusterRadius: 40,
        });

        map.current.addLayer({
          id: "clusters",
          type: "circle",
          source: "data",
          paint: {
            "circle-color": [
              "step",
              ["get", "point_count"],
              "#51bbd6",
              100,
              "#f1f075",
              750,
              "#f28cb1",
            ],
            "circle-radius": [
              "step",
              ["get", "point_count"],
              20,
              100,
              30,
              750,
              40,
            ],
          },
          filter: ["has", "point_count"],
        });

        map.current.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "data",
          filter: ["has", "point_count"],
          layout: {
            "text-field": "{point_count_abbreviated}",
            "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
            "text-size": 14,
          },
        });

        map.current.addLayer({
          id: "unclustered-point",
          type: "circle",
          source: "data",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": "#11b4da",
            "circle-radius": 4,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#fff",
          },
        });

        map.current.on("click", "unclustered-point", (e) => {
          const coordinates = e.features[0].geometry.coordinates.slice();
          const description = e.features[0].properties.ct_en;

          while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
          }

          const popupContent = `
            <div>
              <p><strong>Longitude:</strong> ${e.lngLat.lng}</p>
              <p><strong>Latitude:</strong> ${e.lngLat.lat}</p>
              <p>${description}</p>
            </div>
          `;

          new maplibregl.Popup()
            .setLngLat(coordinates)
            .setHTML(popupContent)
            .addTo(map.current);
        });

        map.current.on("mouseenter", "unclustered-point", () => {
          map.current.getCanvas().style.cursor = "pointer";
        });

        map.current.on("mouseleave", "unclustered-point", () => {
          map.current.getCanvas().style.cursor = "";
        });
        map.current.on("click", "clusters", async (e) => {
          const features = map.current.queryRenderedFeatures(e.point, {
            layers: ["clusters"],
          });
          const clusterId = features[0].properties.cluster_id;
          const zoom = await map.current
            .getSource("data")
            .getClusterExpansionZoom(clusterId);
          map.current.easeTo({
            center: features[0].geometry.coordinates,
            zoom,
          });
        });
        map.current.on("mouseenter", "clusters", () => {
          map.current.getCanvas().style.cursor = "pointer";
        });
        map.current.on("mouseleave", "clusters", () => {
          map.current.getCanvas().style.cursor = "";
        });
      } catch (error) {
        console.error("Error data:", error);
      }
    });
  }, [API_KEY, lng, lat, zoomLevel]);

  ////////// fetchAll /////////////////////////////////////////////////////////////////////////////////////////////////////////
  const fetchDataAll = async () => {
    const totalFetch = Math.ceil(numberMatched / limit);
    let allFeatures = [];

    for (let offset = 0; offset < totalFetch; offset++) {
      console.log(offset);

      const newFeatures = await fetchDataOnlimit(offset * limit, limit);
      allFeatures = [...allFeatures, ...newFeatures];
    }
    return {
      type: "FeatureCollection",
      features: allFeatures,
    };
  };

  ///// fetchDataOnlimit /////////////////////////////////////////////////////////////////////////////////////////////////////////
  const fetchDataOnlimit = async (offset, limit) => {
    try {
      const result = await axios.get(`${url}/${collectionsId}/items`, {
        params: { limit, offset, api_key },
      });

      return result.data.features.map((item) => ({
        type: "FeatureCollection",
        geometry: {
          type: item.geometry.type,
          coordinates: item.geometry.coordinates,
        },
        properties: {
          ct_en: item.properties.ct_en,
          longitude: item.properties.longitude,
          latitude: item.properties.latitude,
        },
      }));
    } catch (err) {
      console.error("Error", err);
      alert("Error");
      return [];
    }
  };

  /// Get County from show List //////////////////////////////////////////////////////////////////////////////////
  const GetCounty = (geoJsonData) => {
    const county = [];
    geoJsonData.features.forEach((feature) => {
      if (!county.includes(feature.properties.ct_en)) {
        county.push(feature.properties.ct_en);
      }
    });
    setInCounty(county);
  };

  /// filter pointmap ///////////////// point ct /////////////////////////////////////////////////////////////
  useEffect(() => {
    if (map.current && point.features) {
      const result = {
        type: "FeatureCollection",
        features: ct
          ? point.features.filter((feature) => feature.properties.ct_en === ct)
          : point.features,
      };
      map.current.getSource("data").setData(result);
    }
  }, [point, ct]);

  /// LogShow Update ////////////////////// inCounty////////////////////////////////////////////////////////
  useEffect(() => {
    console.log("Updated", inCounty);
  }, [inCounty]);

  // hd setcounty and set setActive button /////////////////////////////////////////////////////
  const hdClick = (county) => {
    setActive(county);
    setCt(county || "");
  };

  return (
    <>
      <div ref={mapContainer} className="w-full h-full absolute" />
      <div className="map-wrap relative w-full h-full">
        <div className="absolute  bg-white">
          {loading ? "Loading..." : "Loading Ok"}
        </div>
        <div className="absolute top-5 left-1/2 transform -translate-x-1/2 p-2 bg-white rounded text-sm text-gray-800 text-center w-1/2">
          <div>
            <strong>Lat/Lng Coordinates:</strong>{" "}
            {JSON.stringify(coordinateslocation.lngLat)}
          </div>
          <div>
            <strong>Zoom Level:</strong> {zoomLevel.toFixed(2)}
          </div>
          <test />
        </div>
        {inCounty.length ? (
          <div className="absolute top-40 right-5 p-4 bg-white  rounded text-sm text-gray-800 text-center">
            <Stack spacing={2} direction="column">
              {inCounty.map((county, index) => (
                <Button
                  key={index}
                  variant={active === county ? "contained" : "text"}
                  onClick={() => hdClick(county)}
                >
                  {county}
                </Button>
              ))}
              <Button onClick={() => hdClick()}>AllPoint</Button>
            </Stack>
          </div>
        ) : (
          ""
        )}
      </div>
    </>
  );
}

// Reff
// https://maplibre.org/maplibre-gl-js/docs/
// https://docs.maptiler.com/react/maplibre-gl-js/how-to-use-maplibre-gl-js/
// https://maplibre.org/maplibre-gl-js/docs/examples/popup-on-click/
// https://maplibre.org/maplibre-gl-js/docs/examples/cluster/

// import React, { useRef, useEffect } from "react";
// import maplibregl from "maplibre-gl";
// import "maplibre-gl/dist/maplibre-gl.css";

// export default function Map() {
//   const mapContainer = useRef(null);
//   const map = useRef(null);
//   const lng = 99.9216704;
//   const lat = 14.3515167;
//   const zoom = 14;
//   const API_KEY = "hLy7oyNS4rlUSXJNxYNr";

//   useEffect(() => {
//     if (map.current) return; // stops map from intializing more than once

//     map.current = new maplibregl.Map({
//       container: mapContainer.current,
//       style: `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${API_KEY}`,
//       center: [lng, lat],
//       zoom: zoom,
//     });
//   }, [API_KEY, lng, zoom]);

//   return (
//     <div className="map-wrap">
//       <div ref={mapContainer} className="w-full h-[100vh] absolute" />
//     </div>
//   );
// }
