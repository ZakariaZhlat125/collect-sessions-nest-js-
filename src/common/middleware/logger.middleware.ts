import { IncomingMessage, ServerResponse } from "http";


export function logger(req: IncomingMessage, res: ServerResponse, next: () => void) {
    console.log(`${req.method} ${req.url}`);
    next();
}


// const  obj =  {
//     valuedata : 42,
//     getvalue :()=> this.valuedata,
//     funvalue (){return this.valuedata}
// }

// console.log(obj.getvalue())
// console.log(obj.funvalue())


// const x = []

// if (x) {
//     console.log("1")
// } else {
//     console.log("2")
// }

// const a= {};
// const b = {key:"b"};
// const c = {key:"c"};

// a[b]=123;
// a[c]=456;
// console.log(a[b]);

// a[b] = a["object Object"]