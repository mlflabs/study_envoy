exports.doc1 = {
  _id: '1',
  meta_access: {
    users: {
      mike: {
        r: true,
        w: true
      }
    },
    channels: {
      test: {
        r: true,
        w: true
      },
      invalid:{
        r: true,
        w: true,
      }
    }
  }
};
exports.doc2 = {
  _id: '2',
  meta_access: {
    users: {
      mike: {
        r: true,
        w: false
      }
    },
    channels: {
      test: {
        r: true,
        w: false
      },
      invalid:{
  
      }
    }
  }
};
exports.doc3 = {
  _id: '3',
  meta_access: {
    users: {
      mike: {
        r: false,
        w: false
      }
    },
    channels: {
      test: {
        r: false,
        w: false
      }
    },
    invalid:{

    }
  }
};

exports.doc4 = {
  _id: '4',
  meta_access: {
    users: {
      bob: {
        r: false,
        w: false
      }
    }
  }
};

exports.mike = {
  name: 'mike',
  channels: {
    read: {
      r: true,
      w: false
    },
    write: {
      r: true,
      w: true
    },
    secret: {
      r: false,
      w: false
    },
    invalid: {

    }
  }
}
exports.test1 = {
  name: 'test',
  channels: {
    test: {
      r: true,
      w: true
    },
    invalid: {
      r: true,
      w: true
    }
  }
}
exports.test2 = {
  name: 'test',
  channels: {
    test: {
      r: true,
      w: false
    },
    invalid: {

    }
  }
}
exports.test3 = {
  name: 'test',
  channels: {
    test: {
      r: false,
      w: false
    },
    invalid: {

    }
  }
}
exports.test4 = {
  name: 'test',
  channels: {
    invalid: {

    }
  }
}