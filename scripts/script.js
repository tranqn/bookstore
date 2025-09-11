function loadBookCards(){
    const galleryRef = document.getElementById("books-gallery");
    galleryRef.innerHTML = "";

    for(let bookIndex = 0; bookIndex < books.length; bookIndex++){
            galleryRef.innerHTML += createBookCard(bookIndex);
            createComments(bookIndex);
    }
}

function addComment(bookIndex){
    let commentRef = document.getElementById(`comment-input${bookIndex}`);
    let comment = { "name" : "Anonym",
                    "comment" : commentRef.value,
    };

    books[bookIndex].comments.unshift(comment);
    createComments(bookIndex);
    commentRef.value = "";
}

function addLike(bookIndex){
    const likeIconRef = document.getElementById(`like-icon${bookIndex}`);
    const likesRef = document.getElementById(`likes${bookIndex}`);

    if(likeIconRef.classList.contains("make-red")){
        likeIconRef.src="./assets/icons/heart-thin-icon.png";
        likeIconRef.classList.remove("make-red");
        books[bookIndex].likes = books[bookIndex].likes - 1;
        likesRef.innerHTML = books[bookIndex].likes;

    }
    else{
        likeIconRef.src="./assets/icons/heart-icon.png";
        likeIconRef.classList.add("make-red");
        books[bookIndex].likes = books[bookIndex].likes + 1;
        likesRef.innerHTML = books[bookIndex].likes;
        
    }
}