// Events for the /calendar page, sourced from the USCCB Liturgical Calendar
// for the Dioceses of the United States of America, 2026
// (https://www.usccb.org/resources/2026cal.pdf): solemnities, feasts, and
// principal celebrations, plus the liturgical seasons as multi-day spans.
//
// Each event: { id, title, start, end, time?, notes? } — end is inclusive and
// equals start for single-day events. Days show at most MAX_VISIBLE_EVENTS
// lanes; extras collapse to a "+N" marker.
export const MAX_VISIBLE_EVENTS = 3;

export const EVENTS = [
    { id: 'season-christmas-time-01', title: 'Christmas Time', start: '2026-01-01', end: '2026-01-11', notes: 'Liturgical season (through the Baptism of the Lord)' },
    { id: 'season-lent-02', title: 'Lent', start: '2026-02-18', end: '2026-04-02', notes: 'Liturgical season (Ash Wednesday to Holy Thursday)' },
    { id: 'season-sacred-paschal-triduum-04', title: 'Sacred Paschal Triduum', start: '2026-04-02', end: '2026-04-05', notes: 'Holy Thursday evening through Easter Sunday' },
    { id: 'season-easter-time-04', title: 'Easter Time', start: '2026-04-05', end: '2026-05-24', notes: 'Liturgical season (Easter Sunday to Pentecost)' },
    { id: 'season-advent-11', title: 'Advent', start: '2026-11-29', end: '2026-12-24', notes: 'Liturgical season' },
    { id: 'season-christmas-time-12', title: 'Christmas Time', start: '2026-12-25', end: '2026-12-31', notes: 'Liturgical season (continues into 2027)' },
    { id: 'solemnity-of-mary-the-holy-mother-of-god-01-01', title: 'Solemnity of Mary, the Holy Mother of God', start: '2026-01-01', end: '2026-01-01', notes: 'Solemnity — Holyday of Obligation' },
    { id: 'the-epiphany-of-the-lord-01-04', title: 'The Epiphany of the Lord', start: '2026-01-04', end: '2026-01-04', notes: 'Solemnity' },
    { id: 'the-baptism-of-the-lord-01-11', title: 'The Baptism of the Lord', start: '2026-01-11', end: '2026-01-11', notes: 'Feast' },
    { id: 'the-presentation-of-the-lord-02-02', title: 'The Presentation of the Lord', start: '2026-02-02', end: '2026-02-02', notes: 'Feast' },
    { id: 'ash-wednesday-02-18', title: 'Ash Wednesday', start: '2026-02-18', end: '2026-02-18' },
    { id: 'saint-joseph-spouse-of-the-blessed-virgi-03-19', title: 'Saint Joseph, Spouse of the Blessed Virgin Mary', start: '2026-03-19', end: '2026-03-19', notes: 'Solemnity' },
    { id: 'the-annunciation-of-the-lord-03-25', title: 'The Annunciation of the Lord', start: '2026-03-25', end: '2026-03-25', notes: 'Solemnity' },
    { id: 'palm-sunday-of-the-passion-of-the-lord-03-29', title: 'Palm Sunday of the Passion of the Lord', start: '2026-03-29', end: '2026-03-29' },
    { id: 'thursday-of-holy-week-holy-thursday-04-02', title: 'Thursday of Holy Week (Holy Thursday)', start: '2026-04-02', end: '2026-04-02' },
    { id: 'friday-of-the-passion-of-the-lord-good-f-04-03', title: 'Friday of the Passion of the Lord (Good Friday)', start: '2026-04-03', end: '2026-04-03' },
    { id: 'holy-saturday-04-04', title: 'Holy Saturday', start: '2026-04-04', end: '2026-04-04' },
    { id: 'easter-sunday-of-the-resurrection-of-the-04-05', title: 'Easter Sunday of the Resurrection of the Lord', start: '2026-04-05', end: '2026-04-05', notes: 'Solemnity' },
    { id: 'saint-mark-evangelist-04-25', title: 'Saint Mark, Evangelist', start: '2026-04-25', end: '2026-04-25', notes: 'Feast' },
    { id: 'saint-matthias-apostle-05-14', title: 'Saint Matthias, Apostle', start: '2026-05-14', end: '2026-05-14', notes: 'Feast' },
    { id: 'the-ascension-of-the-lord-05-14', title: 'The Ascension of the Lord', start: '2026-05-14', end: '2026-05-14', notes: 'Solemnity — Holyday of Obligation' },
    { id: 'pentecost-sunday-05-24', title: 'Pentecost Sunday', start: '2026-05-24', end: '2026-05-24', notes: 'Solemnity' },
    { id: 'the-most-holy-trinity-05-31', title: 'The Most Holy Trinity', start: '2026-05-31', end: '2026-05-31', notes: 'Solemnity' },
    { id: 'the-most-holy-body-and-blood-of-christ-06-07', title: 'The Most Holy Body and Blood of Christ', start: '2026-06-07', end: '2026-06-07', notes: 'Solemnity' },
    { id: 'the-most-sacred-heart-of-jesus-06-12', title: 'The Most Sacred Heart of Jesus', start: '2026-06-12', end: '2026-06-12', notes: 'Solemnity' },
    { id: 'the-nativity-of-saint-john-the-baptist-06-24', title: 'The Nativity of Saint John the Baptist', start: '2026-06-24', end: '2026-06-24', notes: 'Solemnity' },
    { id: 'saints-peter-and-paul-apostles-06-29', title: 'Saints Peter and Paul, Apostles', start: '2026-06-29', end: '2026-06-29', notes: 'Solemnity' },
    { id: 'saint-thomas-apostle-07-03', title: 'Saint Thomas, Apostle', start: '2026-07-03', end: '2026-07-03', notes: 'Feast' },
    { id: 'independence-day-07-04', title: 'Independence Day', start: '2026-07-04', end: '2026-07-04' },
    { id: 'saint-mary-magdalene-07-22', title: 'Saint Mary Magdalene', start: '2026-07-22', end: '2026-07-22', notes: 'Feast' },
    { id: 'saint-james-apostle-07-25', title: 'Saint James, Apostle', start: '2026-07-25', end: '2026-07-25', notes: 'Feast' },
    { id: 'the-transfiguration-of-the-lord-08-06', title: 'The Transfiguration of the Lord', start: '2026-08-06', end: '2026-08-06', notes: 'Feast' },
    { id: 'saint-lawrence-deacon-and-martyr-08-10', title: 'Saint Lawrence, Deacon and Martyr', start: '2026-08-10', end: '2026-08-10', notes: 'Feast' },
    { id: 'the-assumption-of-the-blessed-virgin-mar-08-15', title: 'The Assumption of the Blessed Virgin Mary', start: '2026-08-15', end: '2026-08-15', notes: 'Solemnity — Holyday of Obligation' },
    { id: 'saint-bartholomew-apostle-08-24', title: 'Saint Bartholomew, Apostle', start: '2026-08-24', end: '2026-08-24', notes: 'Feast' },
    { id: 'the-nativity-of-the-blessed-virgin-mary-09-08', title: 'The Nativity of the Blessed Virgin Mary', start: '2026-09-08', end: '2026-09-08', notes: 'Feast' },
    { id: 'the-exaltation-of-the-holy-cross-09-14', title: 'The Exaltation of the Holy Cross', start: '2026-09-14', end: '2026-09-14', notes: 'Feast' },
    { id: 'saint-matthew-apostle-and-evangelist-09-21', title: 'Saint Matthew, Apostle and Evangelist', start: '2026-09-21', end: '2026-09-21', notes: 'Feast' },
    { id: 'saints-michael-gabriel-and-raphael-archa-09-29', title: 'Saints Michael, Gabriel and Raphael, Archangels', start: '2026-09-29', end: '2026-09-29', notes: 'Feast' },
    { id: 'saints-simon-and-jude-apostles-10-28', title: 'Saints Simon and Jude, Apostles', start: '2026-10-28', end: '2026-10-28', notes: 'Feast' },
    { id: 'all-saints-11-01', title: 'All Saints', start: '2026-11-01', end: '2026-11-01', notes: 'Solemnity' },
    { id: 'the-dedication-of-the-lateran-basilica-11-09', title: 'The Dedication of the Lateran Basilica', start: '2026-11-09', end: '2026-11-09', notes: 'Feast' },
    { id: 'our-lord-jesus-christ-king-of-the-univer-11-22', title: 'Our Lord Jesus Christ, King of the Universe', start: '2026-11-22', end: '2026-11-22', notes: 'Solemnity' },
    { id: 'thanksgiving-day-11-26', title: 'Thanksgiving Day', start: '2026-11-26', end: '2026-11-26' },
    { id: 'saint-andrew-apostle-11-30', title: 'Saint Andrew, Apostle', start: '2026-11-30', end: '2026-11-30', notes: 'Feast' },
    { id: 'the-immaculate-conception-of-the-blessed-12-08', title: 'The Immaculate Conception of the Blessed Virgin Mary', start: '2026-12-08', end: '2026-12-08', notes: 'Solemnity — Holyday of Obligation' },
    { id: 'our-lady-of-guadalupe-12-12', title: 'Our Lady of Guadalupe', start: '2026-12-12', end: '2026-12-12', notes: 'Feast' },
    { id: 'the-nativity-of-the-lord-christmas-12-25', title: 'The Nativity of the Lord (Christmas)', start: '2026-12-25', end: '2026-12-25', notes: 'Solemnity — Holyday of Obligation' },
    { id: 'saint-stephen-the-first-martyr-12-26', title: 'Saint Stephen, The First Martyr', start: '2026-12-26', end: '2026-12-26', notes: 'Feast' },
    { id: 'the-holy-family-of-jesus-mary-and-joseph-12-27', title: 'The Holy Family of Jesus, Mary and Joseph', start: '2026-12-27', end: '2026-12-27', notes: 'Feast' },
    { id: 'the-holy-innocents-martyrs-12-28', title: 'The Holy Innocents, Martyrs', start: '2026-12-28', end: '2026-12-28', notes: 'Feast' },
];
