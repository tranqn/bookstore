function createBookCard(bookIndex){
    return `<article id="book-card${bookIndex}" class="book-card">
                <h2 class="book-title">${books[bookIndex].name}</h2>
                <img class="book-image" src="./assets/imgs/book-cover.png" alt="">
                <div class="price-likes">
                    <div class="price font-bold">${books[bookIndex].price.toFixed(2)} €</div>
                    <div class="likes-combo">
                        <div id="likes${bookIndex}" class="likes">${books[bookIndex].likes}</div>
                        <img id="like-icon${bookIndex}" class="likes-icon" 
                                                src="./assets/icons/heart-thin-icon.png" 
                                                alt="likes"
                                                onclick="addLike(${bookIndex})">
                    </div>
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
                    <input id="comment-input${bookIndex}" class="comment-input" 
                            type="text" placeholder="Dein Kommentar :)"
                            onclick="removeError(${bookIndex})">
                    <img class="comment-icon" 
                            src="./assets/icons/add_comment.svg" 
                            alt="add comment icon"
                            onclick="addComment(${bookIndex})">
                </div>
            </article>
            `
}

function createComment(bookIndex, commentsIndex){
    return `
            <div class="comment">
                <div class="book-card-left-side">${books[bookIndex].comments[commentsIndex].name}</div>
                <div class="seperator">:    </div>
                <div class="book-card-right-side"> ${books[bookIndex].comments[commentsIndex].comment}</div>
            </div>
            `
}