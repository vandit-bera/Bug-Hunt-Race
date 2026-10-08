// A tiny inventory store. State shape:
//   { stock: { [sku]: number }, log: string[] }
// reduce(state, action) must return a NEW state and never change the old one.
//
// Actions:
//   { type: "receive", sku, qty }  adds qty to the stock of sku
//   { type: "ship", sku, qty }     removes qty; throws if there is not enough
//   { type: "discontinue", sku }   removes a sku that has no stock left

const initialState = { stock: {}, log: [] };

function reduce(state, action) {
  switch (action.type) {
    case "receive": {
      const current = state.stock[action.sku] ?? 0;
      return {
        ...state,
        stock: { ...state.stock, [action.sku]: current + action.qty },
        log: [...state.log, `received ${action.qty} ${action.sku}`],
      };
    }
    case "ship": {
      const current = state.stock[action.sku] ?? 0;
      if (action.qty > current) throw new Error(`not enough ${action.sku}`);
      return {
        ...state,
        stock: { ...state.stock, [action.sku]: current - action.qty },
        log: [...state.log, `shipped ${action.qty} ${action.sku}`],
      };
    }
    case "discontinue": {
      if ((state.stock[action.sku] ?? 0) !== 0) {
        throw new Error(`${action.sku} still has stock`);
      }
      const stock = Object.fromEntries(
        Object.entries(state.stock).filter(([sku]) => sku !== action.sku),
      );
      return {
        ...state,
        stock,
        log: [...state.log, `discontinued ${action.sku}`],
      };
    }
    default:
      return state;
  }
}

// Applies a list of actions, starting from an empty inventory.
function replay(actions) {
  return actions.reduce(reduce, initialState);
}

// Total number of units in stock.
function totalUnits(state) {
  return Object.values(state.stock).reduce((sum, qty) => sum + qty, 0);
}
