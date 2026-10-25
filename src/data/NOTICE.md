# The data in this folder

`stars.json` is the real neighbourhood out to 33 light-years for the star map (ACT1.md, increment
2), copied from [Starman Control](https://github.com/shotif/starman-control) by `npm run data:sky`
(scripts/data/sky.ts); Control's commit is recorded in the file. Control holds Starman Reborn's
census of the Sun's neighbourhood out to 27 light-years and its own shell out to 33, with Reborn's
old lanes. Every value comes from the archives (Gaia DR3, SIMBAD, the NASA Exoplanet Archive, the
Extrasolar Planets Encyclopaedia), each system with the source of its place. Only what the map shows
is kept: each system's place, its stars' names, types and display colours, its known planets'
names and standing, and the source of the primary star's place. The lanes are Reborn's fiction.

Pyre is not in this file: it is the one invented star, held in the game's rules
(src/game/starmap.ts), as in Reborn and Control.

Control's notice names two inputs with licences of their own. The **HYG star database** (CC BY-SA
4.0) gave the places of Procyon B and Ross 614 B, companions whose places this file does not keep,
so nothing from it is here. The **Open Exoplanet Catalogue** gave three planets listed here (Tau Ceti
e, Kapteyn's Star b and 40 Eridani A b, their names and standing), under its licence:

## Open Exoplanet Catalogue

<https://github.com/OpenExoplanetCatalogue/open_exoplanet_catalogue> (Rein 2012,
<https://arxiv.org/abs/1211.7121>)

    Copyright (C) 2012 Hanno Rein

    Permission is hereby granted, free of charge, to any person obtaining a copy of this database
    and associated scripts (the "Database"), to deal in the Database without restriction, including
    without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
    and/or sell copies of the Database, and to permit persons to whom the Database is furnished to
    do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all copies or
    substantial portions of the Database.
    A reference to the Database shall be included in all scientific publications that make use of
    the Database.

    THE DATABASE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
    BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
    NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
    DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE DATABASE OR THE USE OR OTHER DEALINGS IN THE DATABASE.
