function createBookCard(bookIndex){
    return `<div class="book-card">
                <h2 class="book-title">${books[bookIndex].name}</h2>
                <img class="book-image" src="./assets/imgs/book-cover.png" alt="">
                <div class="price-likes">
                    <div class="price">${books[bookIndex].price}</div>
                <div class="likes">${books[bookIndex].likes}</div>
                </div>
                <section class="book-card-details">
                        <div class="book-card-row">
                            <div class="book-card-left-side font-bold">Author</div>
                            <div class="book-card-right-side">: ${books[bookIndex].author}</div>
                        </div>
                        <div class="book-card-row">
                            <div class="book-card-left-side font-bold">E.Jahr</div>
                            <div class="book-card-right-side">: ${books[bookIndex].publishedYear}</div>
                        </div>
                        <div class="book-card-row">
                            <div class="book-card-left-side font-bold">Genre</div>
                            <div class="book-card-right-side">: ${books[bookIndex].genre}</div>
                        </div>
                </section>
                <section class="comments-display">
                    <span>Kommentare:</span>
                    <div id="comments${bookIndex}" class="comments">
                    </div>
                </section>
                <div class="share-comment">
                    <input id="comment-input" class="comment-input" type="text">
                    <img class="comment-icon" src="./assets/icons/add_comment.svg" alt="add comment icon">
                </div>
            </div>
            `
}

function createComments(bookIndex){
    const commentsRef = document.getElementById(`comments${bookIndex}`);
    commentsRef.innerHTML = "";

    for(let commentsIndex = 0; commentsIndex < books[bookIndex].comments.length; commentsIndex++){
        commentsRef.innerHTML += createComment(bookIndex, commentsIndex);
    }
}

function createComment(bookIndex, commentsIndex){
    return `
            <div class="comment">
                <div class="book-card-left-side">${books[bookIndex].comments[commentsIndex].name}</div>
                <div class="book-card-right-side">: ${books[bookIndex].comments[commentsIndex].comment}</div>
            </div>
            `
}