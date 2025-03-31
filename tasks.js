require('dotenv').config();
module.exports = [
  {
    name: 'example',
    func: async client => {},
    interval: 60 * 30,
    runOnStart: true,
    runAsTask: true
  }
];
