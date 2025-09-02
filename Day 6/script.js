
let QuoteBtn = document.querySelector("#quote-gen")
let QuoteCall = document.querySelector("#quote-call")

async function quote_api(){
    try{
    const res = await fetch("https://dummyjson.com/quotes/random");
    const data = await res.json();

    QuoteCall.classList.remove("show");

    setTimeout(() => {
        QuoteCall.innerHTML = `${data.quote} <br> - ${data.author}`;
        QuoteCall.classList.add("show");
    }, 250);
    

    }
    catch(error){
        console.error("Failed to fetch",error);
        
    }
}



