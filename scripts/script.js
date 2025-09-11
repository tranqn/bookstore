function loadBookCards(){
    getBooks();
    const galleryRef = document.getElementById("books-gallery");
    galleryRef.innerHTML = "";

    for(let bookIndex = 0; bookIndex < books.length; bookIndex++){
            galleryRef.innerHTML += createBookCard(bookIndex);
            createComments(bookIndex);
            loadHearts(bookIndex);
    }
}

function addComment(bookIndex){
    let commentRef = document.getElementById(`comment-input${bookIndex}`);
    let inputFieldRef = document.getElementById(`comment-input${bookIndex}`);
    let comment = { 
                    "name" : "Anonym",
                    "comment" : commentRef.value,
                };

    if(commentRef.value == ""){
        inputFieldRef.classList.add("red-border");
        inputFieldRef.placeholder="Sie haben nichts geschrieben :/";
    }
    else{
        books[bookIndex].comments.unshift(comment);
        createComments(bookIndex);
        commentRef.value = "";
        saveBooks();
    }
}

function addLike(bookIndex){
    const likeIconRef = document.getElementById(`like-icon${bookIndex}`);
    const likesRef = document.getElementById(`likes${bookIndex}`);

    if(likeIconRef.classList.contains("make-red")){

        likeIconRef.src="./assets/icons/heart-thin-icon.png";
        likeIconRef.classList.remove("make-red");
        books[bookIndex].likes = books[bookIndex].likes - 1;
        likesRef.innerHTML = books[bookIndex].likes;
        saveBooks();
    }
    else{
        likeIconRef.src="./assets/icons/heart-icon.png";
        likeIconRef.classList.add("make-red");
        books[bookIndex].likes = books[bookIndex].likes + 1;
        likesRef.innerHTML = books[bookIndex].likes;
        saveBooks();
    }
}

function saveBooks(){
    localStorage.setItem("books", JSON.stringify(books));
}

function getBooks(){
    let myArr = JSON.parse(localStorage.getItem("books"));

    if(myArr){
        books = myArr; 
    }
}

function loadHearts(bookIndex){
    const likedRef = document.getElementById(`like-icon${bookIndex}`);

    if(books[bookIndex].liked == true){
        likedRef.src="./assets/icons/heart-icon.png";
        likedRef.classList.add("make-red");
    }
}

function removeError(bookIndex){
    let inputFieldRef = document.getElementById(`comment-input${bookIndex}`);
    inputFieldRef.classList.remove("red-border");
    inputFieldRef.placeholder="Dein Kommentar :)";

}

function loadFav(){
    const galleryRef = document.getElementById("books-gallery");
    galleryRef.innerHTML = "";

        for(let bookIndex = 0; bookIndex < books.length; bookIndex++){
            if(books[bookIndex].liked == true){
                galleryRef.innerHTML += createBookCard(bookIndex);
                createComments(bookIndex);
                loadHearts(bookIndex);
            }
    }
}