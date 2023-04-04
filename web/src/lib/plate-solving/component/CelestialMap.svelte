<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';

  import d3CelestialConfig from '../d3-celestial/config';
  import { addQuadrilateral } from '../d3-celestial/quadrilateral';

  const mergeSexagesimal = (base: number, minutes: number, seconds: number) => {
    const sign = base >= 0 ? 1 : -1;
    return (base * sign + minutes / 60 + seconds / 3600) * sign;
  };

  const raHmsToDec = (hours: number, minutes: number, seconds: number) => {
    return (mergeSexagesimal(hours, minutes, seconds) * 360) / 24;
  };

  const fitIn180 = (decimal: number) => {
    if (decimal > 180) {
      return decimal - 360;
    }
    return decimal;
  };

  const decDmsToDec = (degrees: number, minutes: number, seconds: number) => {
    return mergeSexagesimal(degrees, minutes, seconds);
  };

  const calculateCenter = (points: [number, number, number][][]) => {
    const center = points
      .map(([x, y]: [number, number, number][]) => {
        return [raHmsToDec(...x), decDmsToDec(...y)];
      })
      .reduce((acc: number[], current: number[]) => {
        return [acc[0] + current[0], acc[1] + current[1]];
      });
    const longitude = fitIn180(center[0] / points.length);
    const latitude = center[1] / points.length;
    return [longitude, latitude];
  };

  export var quadrilateralPoints: [number, number, number][][];

  const [longitude, latitude] = calculateCenter(quadrilateralPoints);
  const orientation = 0; // 0 ~ 360

  const _addQuadrilateral = () => {
    const points = quadrilateralPoints.map(([x, y]: [number, number, number][]) => {
      return [fitIn180(raHmsToDec(...x)), decDmsToDec(...y)];
    });
    points.push(points[0]);
    addQuadrilateral(Celestial, points);
  };

  onMount(async () => {
    if (browser) {
      d3CelestialConfig.center = [longitude, latitude, orientation];
      _addQuadrilateral();
      Celestial.display(d3CelestialConfig);
    }
  });
</script>

<div class="celestial-map">
  <div id="map" />
</div>

<style>
  #map {
    width: 100%;
    height: auto;
    margin: 0;
    padding: 0;
    display: inline-block;
    position: relative;
  }
</style>
