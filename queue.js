function Queue(operation) {
  if (!(this instanceof Queue)) {
    return new Queue(operation);
  }
  this.operation = operation;
  this.items = [];
  this.seen = {};
}

Queue.prototype.add = function(...items) {
  const newLinks = items.filter(item => {
    // Skip those items that have been already added
    if (this.seen[item]) return false;
    this.seen[item] = true;
    return true;
  });
  this.items.push(...newLinks);
  return newLinks;
};

Queue.prototype.start = async function*(item) {
  this.add(item);
  let stop = false;
  while (this.items.length > 0 && !stop) {
    const value = await this.operation(this.items.shift(), this);
    stop = yield value;
  }
};

module.exports = Queue;
