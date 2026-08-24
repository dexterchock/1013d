<div align="center">
  <a href="https://1013d.pages.dev/">
    <img src="./public/og-image.jpg" alt="1013D Banner" width="100%" />
  </a>
</div>

<br />

<div align="center">

# 1013D

**See your 3D model at its actual physical size.**

[**Launch 1013D**](https://1013d.pages.dev/)

</div>

---

## What is 1013D?

**1013D** is a browser-based 3D viewer that lets you view STL, OBJ, and 3MF models at **1:1 physical scale**.

A CAD program can tell you that a part is 80 mm wide. A normal 3D viewer can show you the shape. But neither necessarily gives you a good sense of what **80 mm actually looks like**.

1013D was built to solve that specific problem.

After calibrating your display, a model can be displayed at its approximate real-world dimensions on your screen.

> **If the model is 80 mm wide, it should appear about 80 mm wide.**

This makes it useful for checking the size of 3D-printed parts, enclosures, prototypes, and other physical objects before making them.

---

## Features

### 1:1 Physical Scale

Calibrate your display using a known physical reference or your monitor's specifications.

Once calibrated, 1013D maps the model's dimensions to the physical dimensions of your display.

This allows you to compare the model directly against objects such as:

* Rulers
* Components
* Enclosures
* ID cards
* Other physical references

### AR Preview

Take the model beyond the screen and preview it in the real world using supported mobile AR viewers.

Supported workflows include:

* iOS AR Quick Look
* Android Scene Viewer

### 3D Model Support

Supports:

* **STL**
* **OBJ**
* **3MF**

Models are processed directly in the browser.

### Client-Side Processing

The core viewer does not require uploading your 3D model to a remote processing service.

Your model is loaded and processed locally in the browser.

---

## How 1:1 Calibration Works

Displaying a model at physical scale is not as simple as assuming that one screen pixel equals one physical pixel.

Browser zoom, operating-system scaling, device pixel ratio, display resolution, and monitor size can all affect the relationship between rendered pixels and physical dimensions.

1013D therefore uses display calibration to establish that relationship.

You can calibrate using:

* Your display's physical size and resolution
* A standard ISO/IEC 7810 ID-1 card
* Another object with a known physical dimension

Once calibrated, the viewer can determine how many screen pixels correspond to a physical millimetre.

---

## Example

A model measuring:

```text
100 mm × 50 mm × 20 mm
```

can be displayed at approximately:

```text
100 mm × 50 mm × 20 mm
```

on the physical screen.

You can then place a ruler, component, or other reference directly against the display to understand the model's actual size before printing it.

---

## Tech Stack

1013D is a client-side web application built with:

* **TypeScript**
* **React**
* **Vite**
* **Three.js**
* **React Three Fiber**
* **WebGL**
* **Tailwind CSS**

---

## Project Status

1013D is an independent project and is still under development.

It is not intended to replace CAD software or a slicer.

It is built around one specific problem:

> **Understanding the physical size of a digital model before making it.**

Feedback, bug reports, and suggestions are welcome through GitHub Issues.

---

## Author

**[Dexter Chock](https://github.com/dexterchock)**

---

<div align="center">
  <sub>© 2026 1013D</sub>
</div>
