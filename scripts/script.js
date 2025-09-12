function loadBookCards(){
    getBooks();
    const galleryRef = document.getElementById("books-gallery");
    galleryRef.innerHTML = "";

    for(let bookIndex = 0; bookIndex < books.length; bookIndex++){
            galleryRef.innerHTML += createBookCard(bookIndex);
            document.getElementById(`like-icon${bookIndex}`).classList.remove("like-flag");
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

    if(likeIconRef.classList.contains("like-flag")){
            likeIconRef.src="./assets/icons/heart-thin-icon.png";
            likeIconRef.classList.remove("make-red");
            books[bookIndex].likes = books[bookIndex].likes - 1;
            books[bookIndex].liked = false;
            likeIconRef.classList.remove("like-flag");
            likesRef.innerHTML = books[bookIndex].likes;
            saveBooks();
            loadFav();
    }
    else{
        if(likeIconRef.classList.contains("make-red")){

            likeIconRef.src="./assets/icons/heart-thin-icon.png";
            likeIconRef.classList.remove("make-red");
            books[bookIndex].likes = books[bookIndex].likes - 1;
            books[bookIndex].liked = false;
            likesRef.innerHTML = books[bookIndex].likes;
            saveBooks();
        }
        else{
            likeIconRef.src="./assets/icons/heart-icon.png";
            likeIconRef.classList.add("make-red");
            books[bookIndex].likes = books[bookIndex].likes + 1;
            books[bookIndex].liked = true;
            likesRef.innerHTML = books[bookIndex].likes;
            saveBooks();
        }
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
            if(books[bookIndex].liked){
                galleryRef.innerHTML += createBookCard(bookIndex);
                document.getElementById(`like-icon${bookIndex}`).classList.add("like-flag");
                createComments(bookIndex);
                loadHearts(bookIndex);
            }
    }
}

function createComments(bookIndex){
    const commentsRef = document.getElementById(`comments${bookIndex}`);
    commentsRef.innerHTML = "";

    for(let commentsIndex = 0; commentsIndex < books[bookIndex].comments.length; commentsIndex++){
        commentsRef.innerHTML += createComment(bookIndex, commentsIndex);
    }
}

function addLikeFlag(){

}