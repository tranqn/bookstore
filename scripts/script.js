function loadBookCards(){
    const galleryRef = document.getElementById("books-gallery");
    galleryRef.innerHTML = "";

    for(let bookIndex = 0; bookIndex < books.length; bookIndex++){
            galleryRef.innerHTML += createBookCard(bookIndex);
            createComments(bookIndex);
    }
}