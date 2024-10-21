# Injector Offset Viewer

![Website Preview](https://github.com/user-attachments/assets/8fe10b45-f620-494e-b4a7-530fd68f3f0b)
<sub>Total Injectors: **105**</sub>

A website where you can easily look up battery offset data for common automotive injectors.

Don't waste your time digging through a company's website or trying to find the sheet that came with the box.

## Usage

Injectors are searchable by _Brand_, _Description_, _Capacity_ and _Ohms_/_Impendance_.

Cards are hoverable on a computer and clickable on a mobile device.

Just click on either the _voltage_ or _injection time_ values to copy them to your _clipboard_.

Clicking on the Capacity will convert the values between _cc/min_ and _lb/hr_.

https://viruxe.github.io/injector-offset-viewer

# `injector-data.json`

This file is _JSON_ on purpose so it can be consumed externally.

It is used, for example, for https://github.com/VIRUXE/honda-rom-editor to provide presets.

# Contribute

Feel free to add more injector data by editing [`injector-data.json`](https://github.com/VIRUXE/injector-offset-viewer/edit/main/injector-data.json)
