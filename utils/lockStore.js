const editingEstimates = {};
const editingInvoices = {};

const lock = (type, id, user) => {
    if (type === 'estimate') {
        editingEstimates[id] = user;
    } else if (type === 'invoice') {
        editingInvoices[id] = user;
    }
};

const unlock = (type, id) => {
    if (type === 'estimate') {
        delete editingEstimates[id];
    } else if (type === 'invoice') {
        delete editingInvoices[id];
    }
};

const isLocked = (type, id) => {
    if (type === 'estimate') {
        return !!editingEstimates[id];
    } else if (type === 'invoice') {
        return !!editingInvoices[id];
    }
    return false;
};

const getLock = (type, id) => {
    if (type === 'estimate') {
        return editingEstimates[id];
    } else if (type === 'invoice') {
        return editingInvoices[id];
    }
    return null;
};

const getAllLocks = (type) => {
    if (type === 'estimate') {
        return editingEstimates;
    } else if (type === 'invoice') {
        return editingInvoices;
    }
    return {};
}

module.exports = {
    lock,
    unlock,
    isLocked,
    getLock,
    getAllLocks
};
