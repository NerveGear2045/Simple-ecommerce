const fs = require('fs');
const path = require('path');

const deleteFile = filePath => {
  // console.log(path.join(__dirname, '../', 'images', filePath));
  // const p = path.join(path.dirname(process.mainModule.filename), filePath);
  fs.unlink(
    path.join(path.dirname(process.mainModule.filename), filePath),
    error => {
      if (error) {
        throw error;
      }
    }
  );
};

exports.deleteFile = deleteFile;
