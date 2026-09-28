# Bright TapDine customer app refresh

## What will change
- Replace the dark Forest & Moss presentation with the bright TapDine palette: soft light surfaces, electric teal, warm golden-yellow, friendly rounded typography, and restrained shadows.
- Use the supplied TapDine yum-face logo in the map header and derive the favicon from the same brand artwork.
- Keep Google Maps in its standard light appearance and restyle the surrounding search, status, install, and proximity controls to match the Launchpad.
- Redesign map markers as clearly tappable golden deal pins/cards.
- Redesign the selected venue panel as a compact slide-up card with the lead offer image, deal badge, venue, cuisine, distance, price, and a prominent link to the venue page.
- Restyle the venue details page to match without altering its routes or offer behavior.

## Demo content
- Add a small, isolated fixture file containing clearly labelled Brighton demo cafés, pizza, burger, and street-food venues with active offers.
- Add cohesive sample food images for those offers.
- Show the demo set only when no live database venues with active offers are available, so real partner data always takes precedence.
- Make demo venue IDs and source comments obvious so the fixtures can be removed in one place later.

## What stays unchanged
- Geolocation, proximity pings, search, PWA installation, route structure, authentication, offer-claiming behavior, and partner/admin data flows.

## Verification
- Check the map and selected-offer flow at phone and desktop sizes.
- Confirm search still filters pins, selecting a pin opens the card, and the details action reaches the correct venue page.
- Confirm the preview builds without errors and no service worker is introduced.

## Technical details
- Uploaded logo is stored through the project asset flow; a separate small square favicon is placed in `public/`.
- Demo fixtures are merged at the customer read boundary only when live offer content is empty; no database schema or partner records are changed.
- All colors remain semantic tokens in the global design system.
