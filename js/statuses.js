window.FMS = window.FMS || {};

FMS.STATUS = {
  1:{ label:"Einsatzbereit auf Funk",             color:"c-green" },
  2:{ label:"Einsatzbereit Unterkunft / Melder*", color:"c-green" },
  3:{ label:"Einsatzauftrag uebernommen",         color:"c-amber" },
  4:{ label:"Ankunft Einsatzstelle",              color:"c-amber" },
  5:{ label:"Sprechwunsch",                       color:"c-blue"  },
  6:{ label:"Ausser Dienst / nicht einsatzklar",  color:"c-red"   },
  7:{ label:"Einsatzgebunden*",                   color:"c-grey"  },
  8:{ label:"Bedingt einsatzbereit*",             color:"c-grey"  },
  9:{ label:"Verstanden / Bestaetigung",          color:"c-blue"  },
  0:{ label:"Eigener Notruf",                     color:"c-red"   }
};

/* Reihenfolge im Tastenfeld (klassisch, 0 unten mittig) */
FMS.ORDER = [1,2,3,4,5,6,7,8,9,0];

/* Statusfarbe -> CSS-Variable (fuer die Anzeige-Leiste) */
FMS.COLORVAR = {
  "c-green":"var(--green)", "c-amber":"var(--amber)", "c-red":"var(--red)",
  "c-blue":"var(--blue)",   "c-grey":"var(--grey)"
};
